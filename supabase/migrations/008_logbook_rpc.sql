-- Add missing tip_claimed column
alter table logbook
  add column if not exists tip_claimed boolean not null default false;

-- Toggle tip claimed status atomically
create or replace function toggle_tip_claimed(p_log_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new boolean;
begin
  update logbook
  set tip_claimed = not tip_claimed
  where log_id = p_log_id
  returning tip_claimed into v_new;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Entry not found.');
  end if;

  return jsonb_build_object('success', true, 'tipClaimed', v_new);
end;
$$;

-- Mark delivered / partial / undelivered
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

  return jsonb_build_object(
    'success', true,
    'deliveredTime', case when p_status in ('Delivered','Partial') then v_time::text else '' end,
    'deliveredDate', case when p_status in ('Delivered','Partial') then v_date::text else '' end
  );
end;
$$;

-- Void an order — cascades across pautang, commissions, cash_drawer,
-- slim_poly, prod_count, logbook, and marks sales as Void.
create or replace function void_logbook_order(p_log_id text, p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row pautang%rowtype;
begin
  for v_row in select * from pautang where order_id = p_order_id
  loop
    if lower(v_row.status) in ('utang','partial') and v_row.customer_id is not null then
      update customers
      set utang = greatest(0, utang - v_row.amount)
      where customer_id = v_row.customer_id;
    end if;
  end loop;

  delete from pautang where order_id = p_order_id;
  delete from commissions where order_id = p_order_id;
  delete from slim_poly where order_id = p_order_id;
  delete from prod_count where order_id = p_order_id;
  delete from cash_drawer where order_id = p_order_id;
  delete from logbook where order_id = p_order_id;
  update sales set status = 'Void' where order_id = p_order_id;

  return jsonb_build_object('success', true, 'message', 'Order ' || p_order_id || ' has been voided.');
end;
$$;

-- Reassign point person on Logbook + Pautang + Commissions
create or replace function update_logbook_point_person(p_log_id text, p_order_id text, p_new_point_person text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log logbook%rowtype;
  v_updated_count integer := 0;
  v_commission_rate numeric := 0;
begin
  select * into v_log from logbook where log_id = p_log_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Entry not found.');
  end if;

  update logbook set point_person = p_new_point_person where log_id = p_log_id;

  if p_order_id is not null and p_order_id <> '' then
    update pautang set point_person = p_new_point_person where order_id = p_order_id;

    if p_new_point_person is null or p_new_point_person = '' then
      delete from commissions where order_id = p_order_id;
    else
      update commissions set point_person = p_new_point_person where order_id = p_order_id;
      get diagnostics v_updated_count = row_count;

      if v_updated_count = 0 then
        select commission_rate into v_commission_rate
        from products
        where lower(trim(name)) = lower(trim(v_log.product))
        limit 1;

        if coalesce(v_commission_rate, 0) > 0 and v_log.qty > 0 then
          insert into commissions (
            order_id, date, customer_name, location, product, quantity,
            point_person, total_commission
          ) values (
            p_order_id, v_log.date, v_log.customer_name, v_log.location,
            v_log.product, v_log.qty, p_new_point_person, v_commission_rate * v_log.qty
          );
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Point person updated to "' || coalesce(nullif(p_new_point_person, ''), '(none)') || '".'
  );
end;
$$;

-- Splits a Partial-in-progress order into a closed original half + a new
-- Undelivered row (remaining qty) assigned to the new driver.
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

  update logbook
  set qty = v_log.qty_delivered,
      status = 'Delivered',
      qty_delivered = v_log.qty_delivered,
      linked_log_id = v_new_log_id
  where log_id = p_log_id;

  insert into logbook (
    log_id, order_id, date, time, customer_name, location, point_person,
    product, qty, status, delivered_time, qty_delivered, delivered_date,
    linked_log_id, tip, notes
  ) values (
    v_new_log_id, v_log.order_id, v_log.date, v_log.time, v_log.customer_name, v_log.location,
    p_new_point_person, v_log.product, v_remaining, 'Undelivered', null, 0, null,
    p_log_id, 0, v_log.notes
  );

  select * into v_comm from commissions
  where order_id = p_order_id and product = v_log.product
  limit 1;

  if found and v_comm.quantity > 0 then
    v_rate := v_comm.total_commission / v_comm.quantity;
    update commissions
    set quantity = v_log.qty_delivered,
        total_commission = round(v_rate * v_log.qty_delivered, 2)
    where id = v_comm.id;

    insert into commissions (order_id, date, customer_name, location, product, quantity, point_person, total_commission)
    values (v_comm.order_id, v_comm.date, v_comm.customer_name, v_comm.location, v_log.product, v_remaining, p_new_point_person, round(v_rate * v_remaining, 2));
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

grant execute on function toggle_tip_claimed(text) to anon;
grant execute on function mark_logbook_delivered(text, text, numeric) to anon;
grant execute on function void_logbook_order(text, text) to anon;
grant execute on function update_logbook_point_person(text, text, text) to anon;
grant execute on function split_logbook_partial_reassign(text, text, text) to anon;