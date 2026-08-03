-- Allow the same literal status values Logbook uses (GAS mirrors the
-- Logbook status straight onto the linked Commissions row).
alter table commissions drop constraint if exists commissions_delivered_check;
alter table commissions add constraint commissions_delivered_check
  check (delivered in ('Undelivered', 'Partial', 'Delivered'));

-- Mirrors _getEffectiveCommissionRate from LogbookServer.gs / POSServer.gs:
-- Commission-Based staff use their own per-product rate; everyone else
-- falls back to the product's default commission_rate.
create or replace function get_effective_commission_rate(p_product text, p_point_person text)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_product_id text;
  v_default_rate numeric := 0;
  v_staff_row staff%rowtype;
begin
  if p_product is null or p_point_person is null or trim(p_point_person) = '' then
    return 0;
  end if;

  select product_id, coalesce(commission_rate, 0) into v_product_id, v_default_rate
  from products
  where lower(trim(name)) = lower(trim(p_product))
  limit 1;

  select * into v_staff_row from staff where lower(trim(name)) = lower(trim(p_point_person)) limit 1;

  if found and v_staff_row.type = 'Commission-Based' then
    return case v_product_id
      when 'PROD-000001' then coalesce(v_staff_row.commission_5gal, 0)
      when 'PROD-000002' then coalesce(v_staff_row.commission_1000ml, 0)
      when 'PROD-000004' then coalesce(v_staff_row.commission_500ml, 0)
      when 'PROD-000005' then coalesce(v_staff_row.commission_slim, 0)
      else 0
    end;
  end if;

  return coalesce(v_default_rate, 0);
end;
$$;

-- markLogbookDelivered now mirrors the literal status onto Commissions
-- (Partial stays "Partial", not collapsed to "Undelivered").
create or replace function mark_logbook_delivered(p_log_id text, p_status text, p_delivered_qty numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row logbook%rowtype;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
  v_dqty numeric;
begin
  select * into v_row from logbook where log_id = p_log_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Entry not found.');
  end if;

  v_dqty := case
    when p_status = 'Delivered' then v_row.qty
    when p_status = 'Partial' then coalesce(p_delivered_qty, 0)
    else 0
  end;

  update logbook
  set
    status = p_status,
    delivered_time = case when p_status in ('Delivered','Partial') then v_time else null end,
    delivered_date = case when p_status in ('Delivered','Partial') then v_date else null end,
    qty_delivered = v_dqty
  where log_id = p_log_id;

  update commissions
  set delivered = p_status
  where order_id = v_row.order_id
    and lower(trim(coalesce(point_person, ''))) = lower(trim(coalesce(v_row.point_person, '')))
    and lower(trim(product)) = lower(trim(v_row.product));

  return jsonb_build_object(
    'success', true,
    'deliveredTime', case when p_status in ('Delivered','Partial') then v_time::text else '' end,
    'deliveredDate', case when p_status in ('Delivered','Partial') then v_date::text else '' end
  );
end;
$$;

-- Recomputes the commission for the NEW point person's effective rate
-- instead of just moving the row with its old amount unchanged.
create or replace function update_logbook_point_person(p_log_id text, p_order_id text, p_new_point_person text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log logbook%rowtype;
  v_new_rate numeric;
  v_existing_id uuid;
  v_existing_qty numeric;
begin
  select * into v_log from logbook where log_id = p_log_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Entry not found.');
  end if;

  update logbook set point_person = p_new_point_person where log_id = p_log_id;

  if p_order_id is not null and p_order_id <> '' then
    update pautang set point_person = p_new_point_person where order_id = p_order_id;

    v_new_rate := get_effective_commission_rate(v_log.product, p_new_point_person);

    select id, quantity into v_existing_id, v_existing_qty
    from commissions
    where order_id = p_order_id and product = v_log.product
    limit 1;

    if p_new_point_person is null or p_new_point_person = '' or v_new_rate <= 0 then
      if v_existing_id is not null then
        delete from commissions where id = v_existing_id;
      end if;
    elsif v_existing_id is not null then
      update commissions
      set point_person = p_new_point_person,
          total_commission = v_new_rate * coalesce(v_existing_qty, v_log.qty)
      where id = v_existing_id;
    elsif v_log.qty > 0 then
      insert into commissions (order_id, date, customer_name, location, product, quantity, point_person, total_commission, delivered)
      values (p_order_id, v_log.date, v_log.customer_name, v_log.location, v_log.product, v_log.qty, p_new_point_person, v_new_rate * v_log.qty, v_log.status);
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Point person updated to "' || coalesce(nullif(p_new_point_person, ''), '(none)') || '".'
  );
end;
$$;

grant execute on function update_logbook_point_person(text, text, text) to anon;

-- Split-reassign should match Commissions rows by order_id + product only
-- (not point_person too), matching GAS exactly.
create or replace function split_logbook_partial_reassign(p_log_id text, p_order_id text, p_new_point_person text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log logbook%rowtype;
  v_remaining numeric;
  v_new_log_id text;
  v_original_person text;
  v_comm commissions%rowtype;
  v_rate numeric;
begin
  select * into v_log from logbook where log_id = p_log_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Logbook entry not found.');
  end if;

  if v_log.status <> 'Partial' or coalesce(v_log.qty_delivered,0) <= 0 or v_log.qty_delivered >= v_log.qty then
    return update_logbook_point_person(p_log_id, p_order_id, p_new_point_person);
  end if;

  v_remaining := v_log.qty - v_log.qty_delivered;
  v_original_person := v_log.point_person;
  v_new_log_id := public.next_id('LOG'::text);

  insert into logbook (
    log_id, order_id, date, time, customer_name, location, point_person,
    product, qty, status, delivered_time, qty_delivered, delivered_date,
    linked_log_id, tip, notes
  ) values (
    v_new_log_id, v_log.order_id, v_log.date, v_log.time, v_log.customer_name, v_log.location,
    p_new_point_person, v_log.product, v_remaining, 'Undelivered', null, 0, null,
    p_log_id, 0, v_log.notes
  );

  update logbook
  set qty = v_log.qty_delivered,
      status = 'Delivered',
      qty_delivered = v_log.qty_delivered,
      linked_log_id = v_new_log_id
  where log_id = p_log_id;

  select * into v_comm from commissions
  where order_id = p_order_id and product = v_log.product
  limit 1;

  if found and v_comm.quantity > 0 then
    v_rate := v_comm.total_commission / v_comm.quantity;

    update commissions
    set quantity = v_log.qty_delivered,
        total_commission = round(v_rate * v_log.qty_delivered, 2),
        delivered = 'Delivered'
    where id = v_comm.id;

    insert into commissions (order_id, date, customer_name, location, product, quantity, point_person, total_commission, delivered)
    values (v_comm.order_id, v_comm.date, v_comm.customer_name, v_comm.location, v_log.product, v_remaining, p_new_point_person, round(v_rate * v_remaining, 2), 'Undelivered');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Split: ' || v_log.qty_delivered || ' kept with ' || coalesce(nullif(v_original_person,''),'original driver') ||
               ', ' || v_remaining || ' reassigned to ' || coalesce(nullif(p_new_point_person,''),'No point person'),
    'newLogId', v_new_log_id,
    'newEntry', jsonb_build_object(
      'logId', v_new_log_id,
      'orderId', v_log.order_id,
      'date', v_log.date::text,
      'time', v_log.time::text,
      'customerName', v_log.customer_name,
      'location', v_log.location,
      'pointPerson', p_new_point_person,
      'product', v_log.product,
      'qty', v_remaining,
      'status', 'Undelivered',
      'deliveredTime', '',
      'deliveredQty', 0,
      'linkedLogId', p_log_id,
      'notes', coalesce(v_log.notes,'')
    ),
    'originalLinkedLogId', v_new_log_id
  );
end;
$$;

grant execute on function get_effective_commission_rate(text, text) to anon;
grant execute on function mark_logbook_delivered(text, text, numeric) to anon;
grant execute on function update_logbook_point_person(text, text, text) to anon;
grant execute on function split_logbook_partial_reassign(text, text, text) to anon;