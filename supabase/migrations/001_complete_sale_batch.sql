-- =====================================================================
-- complete_sale_batch — atomic POS checkout (replaces Apps Script
-- completeSaleBatch / _completeSaleBatchInner)
--
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- Requires: next_id(), and all tables from the main schema.
-- =====================================================================

-- Idempotency table (replaces ProcessedRequests sheet)
create table if not exists processed_requests (
  request_id text primary key,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table processed_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'processed_requests' and policyname = 'anon full access'
  ) then
    drop policy if exists "authenticated full access" on processed_requests;
    create policy "anon full access" on processed_requests
      for all to anon using (true) with check (true);
  end if;
end $$;

-- Helper: get the current open shift id (replaces _getActiveShiftId)
create or replace function get_active_shift_id()
returns text
language sql
stable
as $$
  select shift_id
  from shift
  where status = 'Open'
  order by date desc, time desc
  limit 1;
$$;

-- Main checkout RPC
create or replace function complete_sale_batch(batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id    text;
  v_existing      jsonb;
  v_shift_id      text;
  v_now           timestamptz := now();
  v_date          date        := (v_now at time zone 'Asia/Manila')::date;
  v_time          time        := (v_now at time zone 'Asia/Manila')::time;
  v_results       jsonb       := '[]'::jsonb;

  v_payload       jsonb;
  v_borrow        jsonb;
  v_item          jsonb;

  v_cust_name     text;
  v_cust_name_key text;
  v_customer_id   text;
  v_cust_row      customers%rowtype;

  v_order_id      text;
  v_pautang_id    text;
  v_cd_id         text;
  v_borrow_id     text;
  v_log_id        text;

  v_total         numeric;
  v_paid          numeric;
  v_unpaid        numeric;
  v_gallon        numeric;
  v_dispenser     numeric;
  v_gallon_type   text;
  v_pay_method    text;
  v_tx_id         text;
  v_staff_row     staff%rowtype;
  v_effective_rate numeric;
  v_pid           text;
  v_prod_count_ids text[] := array['PROD-000008','PROD-000009','PROD-000010','PROD-000011'];
  v_borrowed_gallon boolean;
begin
  v_request_id := batch->>'clientRequestId';

  -- Fast-path idempotency
  if v_request_id is not null then
    select result_json into v_existing
    from processed_requests
    where request_id = v_request_id;

    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_shift_id := get_active_shift_id();

  -- ── Regular sale payloads (grouped by customer) ───────────────────
  for v_payload in select * from jsonb_array_elements(coalesce(batch->'payloads', '[]'::jsonb))
  loop
    v_cust_name     := trim(v_payload->>'customer');
    v_cust_name_key := lower(v_cust_name);
    v_customer_id   := v_cust_name;

    -- Look up existing customer
    select * into v_cust_row
    from customers
    where lower(trim(name)) = v_cust_name_key
    limit 1;

    -- Create new customer if needed
    if not found and coalesce((v_payload->>'isNewCustomer')::boolean, false)
       and v_cust_name <> 'Pickup Customer' then
      v_customer_id := public.next_id('CUST'::text);
      insert into customers (customer_id, name, location, point_person, utang, gallon, dispenser)
      values (
        v_customer_id,
        v_cust_name,
        coalesce(v_payload->>'location', ''),
        coalesce(v_payload->>'pointPerson', ''),
        0, 0, 0
      );
      select * into v_cust_row from customers where customer_id = v_customer_id;
    elsif found then
      v_customer_id := v_cust_row.customer_id;
    end if;

    -- Process each cart line item
    for v_item in select * from jsonb_array_elements(coalesce(v_payload->'cart', '[]'::jsonb))
    loop
      v_order_id := public.next_id('ORD'::text);
      v_total    := coalesce((v_item->>'price')::numeric, 0) * coalesce((v_item->>'qty')::numeric, 0);
      v_paid     := coalesce((v_item->>'amountPaid')::numeric, 0);
      v_unpaid   := greatest(0, v_total - v_paid);
      v_pautang_id := '';

      v_pay_method := case when v_item->>'paymentMethod' = 'GCash' then 'GCash' else 'Cash' end;

      insert into sales (
        order_id, date, time, customer_name, location, product, quantity,
        point_person, total_amount, amount_paid, status, recorded,
        slim_poly, product_id, tip, notes, payment_method
      ) values (
        v_order_id,
        v_date,
        v_time,
        v_cust_name,
        coalesce(v_payload->>'location', ''),
        v_item->>'name',
        coalesce((v_item->>'qty')::numeric, 0),
        coalesce(v_payload->>'pointPerson', ''),
        v_total,
        v_paid,
        coalesce(v_item->>'status', 'Utang'),
        'No',
        coalesce(v_item->>'slimPoly', ''),
        v_item->>'id',
        coalesce((v_item->>'tip')::numeric, 0),
        coalesce(v_item->>'notes', ''),
        v_pay_method
      );

      -- Prod count tracking
      if (v_item->>'id') = any(v_prod_count_ids) then
        insert into prod_count (order_id, customer_name, product, quantity, shift_id)
        values (
          v_order_id,
          v_cust_name,
          v_item->>'name',
          coalesce((v_item->>'qty')::numeric, 0),
          v_shift_id
        );
      end if;

      -- Slim/Poly tracking
      if coalesce(v_item->>'slimPoly', '') in ('Slim', 'Poly') then
        insert into slim_poly (order_id, customer_name, product, quantity, slim_poly, shift_id)
        values (
          v_order_id,
          v_cust_name,
          v_item->>'name',
          coalesce((v_item->>'qty')::numeric, 0),
          v_item->>'slimPoly',
          v_shift_id
        );
      end if;

      -- Commission — Commission-Based staff use per-product rates from
      -- their Staff record; everyone else falls back to the product's
      -- flat commission_rate (same as before staff types existed).
      v_pid := coalesce(v_item->>'id', '');

      select * into v_staff_row
      from staff
      where lower(trim(name)) = lower(trim(coalesce(v_payload->>'pointPerson', '')))
      limit 1;

      if found and v_staff_row.type = 'Commission-Based' then
        v_effective_rate := case v_pid
          when 'PROD-000001' then coalesce(v_staff_row.commission_5gal, 0)
          when 'PROD-000002' then coalesce(v_staff_row.commission_1000ml, 0)
          when 'PROD-000004' then coalesce(v_staff_row.commission_500ml, 0)
          when 'PROD-000005' then coalesce(v_staff_row.commission_slim, 0)
          else 0
        end;
      else
        v_effective_rate := coalesce((v_item->>'commissionRate')::numeric, 0);
      end if;

      if v_effective_rate > 0 and coalesce(v_payload->>'pointPerson', '') <> '' then
        insert into commissions (
          order_id, date, customer_name, location, product, quantity,
          point_person, total_commission, delivered
        ) values (
          v_order_id,
          v_date,
          v_cust_name,
          coalesce(v_payload->>'location', ''),
          v_item->>'name',
          coalesce((v_item->>'qty')::numeric, 0),
          v_payload->>'pointPerson',
          v_effective_rate * coalesce((v_item->>'qty')::numeric, 0),
          'Undelivered'
        );
      end if;

      -- Pautang (credit) + customer utang balance
      if coalesce(v_item->>'status', '') in ('Utang', 'Partial') and v_unpaid > 0 then
        v_pautang_id := public.next_id('PAUT'::text);
        insert into pautang (
          pautang_id, order_id, date, time, customer_name, customer_id,
          amount, point_person, status, charge_status
        ) values (
          v_pautang_id,
          v_order_id,
          v_date,
          v_time,
          v_cust_name,
          case when v_cust_name = 'Pickup Customer' then null else v_customer_id end,
          v_unpaid,
          coalesce(v_payload->>'pointPerson', ''),
          v_item->>'status',
          'No'
        );

        if v_cust_name <> 'Pickup Customer' and v_cust_row.customer_id is not null then
          update customers
          set utang = utang + v_unpaid
          where customer_id = v_cust_row.customer_id;
        end if;
      end if;

      -- Cash drawer inflow for paid amounts
      if v_paid > 0 then
        v_cd_id := public.next_id('CD'::text);
        insert into cash_drawer (
          id, date, time, type, order_id, customer_id,
          description, amount, point_person, shift_id, pautang_id, payment_method
        ) values (
          v_cd_id,
          v_date,
          v_time,
          'in',
          v_order_id,
          case when v_cust_name = 'Pickup Customer' then 'Pickup Customer' else v_customer_id end,
          'Sale - ' || v_cust_name,
          v_paid,
          coalesce(v_payload->>'pointPerson', ''),
          v_shift_id,
          v_pautang_id,
          v_pay_method
        );

        if v_pay_method = 'GCash' then
          v_tx_id := public.next_id('TXN'::text);
          insert into cash_transactions (
            tx_id, date, time, type, from_account, to_account,
            amount, reference_number, description, shift_id, status
          ) values (
            v_tx_id,
            v_date,
            v_time,
            'Sales',
            null,
            'ACC-000003',
            v_paid,
            v_order_id,
            'GCash sale payment - ' || v_cust_name,
            v_shift_id,
            'Verified'
          );

          update cash_accounts
          set balance = balance + v_paid
          where account_id = 'ACC-000003';
        end if;
      end if;

      -- Logbook (skip pickup customer)
      if lower(v_cust_name) <> 'pickup customer' then
        v_log_id := public.next_id('LOG'::text);
        insert into logbook (
          log_id, order_id, date, time, customer_name, location,
          point_person, product, qty, status, tip, notes
        ) values (
          v_log_id,
          v_order_id,
          v_date,
          v_time,
          v_cust_name,
          coalesce(v_payload->>'location', ''),
          coalesce(v_payload->>'pointPerson', ''),
          v_item->>'name',
          coalesce((v_item->>'qty')::numeric, 0),
          'Undelivered',
          coalesce((v_item->>'tip')::numeric, 0),
          coalesce(v_item->>'notes', '')
        );
      end if;

      -- Customer is borrowing the 5-Gallon container(s) along with this
      -- sale — create a Borrowed record and add to their running gallon
      -- total. Skipped for Pickup Customer (never has a customer row).
      v_borrowed_gallon := coalesce((v_item->>'borrowedGallon')::boolean, false);
      if v_borrowed_gallon
         and coalesce((v_item->>'qty')::numeric, 0) > 0
         and lower(v_cust_name) <> 'pickup customer'
         and v_cust_row.customer_id is not null then
        v_borrow_id := public.next_id('BRW'::text);
        insert into borrowed (
          borrow_id, date, time, customer_id, customer_name,
          gallon, dispenser, borrow_status, record_status, gallon_type
        ) values (
          v_borrow_id,
          v_date,
          v_time,
          v_cust_row.customer_id,
          v_cust_name,
          coalesce((v_item->>'qty')::numeric, 0),
          0,
          'Borrowed',
          'No',
          nullif(v_item->>'slimPoly', '')
        );

        update customers
        set gallon = gallon + coalesce((v_item->>'qty')::numeric, 0),
            gallon_slim = gallon_slim + case when v_item->>'slimPoly' = 'Slim' then coalesce((v_item->>'qty')::numeric, 0) else 0 end,
            gallon_poly = gallon_poly + case when v_item->>'slimPoly' = 'Poly' then coalesce((v_item->>'qty')::numeric, 0) else 0 end
        where customer_id = v_cust_row.customer_id;
      end if;
    end loop;

    v_results := v_results || jsonb_build_array(jsonb_build_object('success', true));
  end loop;

  -- ── Borrow payloads ───────────────────────────────────────────────
  for v_borrow in select * from jsonb_array_elements(coalesce(batch->'borrowPayloads', '[]'::jsonb))
  loop
    v_cust_name     := trim(v_borrow->>'customer');
    v_cust_name_key := lower(v_cust_name);
    v_gallon        := coalesce((v_borrow->>'gallon')::numeric, 0);
    v_dispenser     := coalesce((v_borrow->>'dispenser')::numeric, 0);
    v_gallon_type   := nullif(v_borrow->>'gallonType', '');

    select * into v_cust_row
    from customers
    where lower(trim(name)) = v_cust_name_key
    limit 1;

    if not found then
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('success', false, 'message', 'Customer not found: ' || v_cust_name)
      );
      continue;
    end if;

    v_borrow_id := public.next_id('BRW'::text);
    insert into borrowed (
      borrow_id, date, time, customer_id, customer_name,
      gallon, dispenser, borrow_status, record_status, gallon_type
    ) values (
      v_borrow_id,
      v_date,
      v_time,
      v_cust_row.customer_id,
      v_cust_name,
      v_gallon,
      v_dispenser,
      'Borrowed',
      'No',
      v_gallon_type
    );

    -- Cash drawer memo (zero amount)
    v_cd_id := public.next_id('CD'::text);
    insert into cash_drawer (
      id, date, time, type, order_id, customer_id,
      description, amount, point_person, shift_id, pautang_id
    ) values (
      v_cd_id,
      v_date,
      v_time,
      'in',
      v_borrow_id,
      v_cust_row.customer_id,
      'Borrow - ' || v_cust_name
        || case when v_gallon > 0 then ' | Gallon x' || v_gallon::text else '' end
        || case when v_dispenser > 0 then ' | Dispenser x' || v_dispenser::text else '' end,
      0,
      coalesce(v_borrow->>'pointPerson', ''),
      v_shift_id,
      ''
    );

    -- Update customer gallon/dispenser counts
    update customers
    set
      gallon      = gallon      + v_gallon,
      dispenser   = dispenser   + v_dispenser,
      gallon_slim = gallon_slim + case when v_gallon_type = 'Slim' then v_gallon else 0 end,
      gallon_poly = gallon_poly + case when v_gallon_type = 'Poly' then v_gallon else 0 end
    where customer_id = v_cust_row.customer_id;

    v_results := v_results || jsonb_build_array(jsonb_build_object('success', true));
  end loop;

  -- Mark request as processed
  if v_request_id is not null then
    insert into processed_requests (request_id, result_json)
    values (v_request_id, v_results)
    on conflict (request_id) do nothing;
  end if;

  return v_results;
end;
$$;

-- Grant execute to anon (app uses publishable key, no login)
grant execute on function complete_sale_batch(jsonb) to anon;
grant execute on function get_active_shift_id() to anon;
