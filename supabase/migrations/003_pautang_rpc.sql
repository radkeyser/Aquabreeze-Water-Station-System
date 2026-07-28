-- Pautang payment + point-person reassignment RPCs
-- Requires: next_id(), get_active_shift_id() from 001_complete_sale_batch.sql

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

create or replace function pay_pautang(order_ids text[], amount_paid numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining numeric := coalesce(amount_paid, 0);
  v_order_id    text;
  v_row         pautang%rowtype;
  v_pay         numeric;
  v_cd_id       text;
  v_shift_id    text;
  v_now         timestamptz := now();
  v_date        date        := (v_now at time zone 'Asia/Manila')::date;
  v_time        time        := (v_now at time zone 'Asia/Manila')::time;
  v_found       boolean     := false;
begin
  if v_remaining <= 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid amount.');
  end if;

  v_shift_id := get_active_shift_id();

  foreach v_order_id in array order_ids
  loop
    exit when v_remaining <= 0;

    select * into v_row
    from pautang
    where order_id = v_order_id
    limit 1;

    if not found then
      continue;
    end if;

    v_found := true;
    v_pay := least(v_remaining, v_row.amount);
    v_remaining := v_remaining - v_pay;

    if v_pay >= v_row.amount then
      delete from pautang where pautang_id = v_row.pautang_id;
      if v_row.customer_id is not null then
        update customers
        set utang = greatest(0, utang - v_row.amount)
        where customer_id = v_row.customer_id;
      else
        update customers
        set utang = greatest(0, utang - v_row.amount)
        where lower(trim(name)) = lower(trim(v_row.customer_name));
      end if;
    else
      update pautang
      set amount = amount - v_pay, status = 'Partial'
      where pautang_id = v_row.pautang_id;

      if v_row.customer_id is not null then
        update customers
        set utang = greatest(0, utang - v_pay)
        where customer_id = v_row.customer_id;
      else
        update customers
        set utang = greatest(0, utang - v_pay)
        where lower(trim(name)) = lower(trim(v_row.customer_name));
      end if;
    end if;

    v_cd_id := public.next_id('CD'::text);
    insert into cash_drawer (
      id, date, time, type, order_id, customer_id,
      description, amount, point_person, shift_id, pautang_id
    ) values (
      v_cd_id,
      v_date,
      v_time,
      'in',
      v_order_id,
      v_row.customer_id,
      'Pautang Payment - ' || v_row.customer_name,
      v_pay,
      v_row.point_person,
      v_shift_id,
      v_row.pautang_id
    );
  end loop;

  if not v_found then
    return jsonb_build_object('success', false, 'message', 'Order not found.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Payment recorded!');
end;
$$;

create or replace function update_pautang_point_person(order_ids text[], new_point_person text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update pautang
  set point_person = new_point_person
  where order_id = any(order_ids);

  update commissions
  set point_person = new_point_person
  where order_id = any(order_ids);

  update logbook
  set point_person = new_point_person
  where order_id = any(order_ids);

  return jsonb_build_object(
    'success', true,
    'message', 'Point person updated to "' || coalesce(nullif(new_point_person, ''), '(none)') || '".'
  );
end;
$$;

grant execute on function pay_pautang(text[], numeric) to anon;
grant execute on function update_pautang_point_person(text[], text) to anon;
grant execute on function get_active_shift_id() to anon;
