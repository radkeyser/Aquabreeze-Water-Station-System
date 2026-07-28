-- Payroll RPCs — staff CRUD, advances, release, mass clear, charge debts
-- Requires: next_id(), get_active_shift_id() from 001_complete_sale_batch.sql

create or replace function get_staff_commission(p_name text)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(total_commission), 0)
  from commissions
  where lower(trim(coalesce(point_person, ''))) = lower(trim(coalesce(p_name, '')));
$$;

create or replace function add_staff(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_name text := trim(data->>'name');
  v_role text := trim(data->>'role');
  v_rate numeric := coalesce((data->>'dailyRate')::numeric, 0);
begin
  if v_name = '' then
    return jsonb_build_object('success', false, 'message', 'Name is required.');
  end if;
  if v_role = '' then
    return jsonb_build_object('success', false, 'message', 'Role is required.');
  end if;
  if v_rate <= 0 then
    return jsonb_build_object('success', false, 'message', 'Daily rate is required.');
  end if;

  v_id := public.next_id('STF'::text);

  insert into staff (staff_id, name, role)
  values (v_id, v_name, v_role);

  insert into payroll (
    staff_id, name, role, days_worked, daily_rate, advance,
    commission, debt_charge, expected_salary, status
  ) values (
    v_id, v_name, v_role, 0, v_rate, 0, 0, 0, 0, 'Pending'
  );

  return jsonb_build_object('success', true, 'message', v_name || ' added successfully!');
end;
$$;

create or replace function update_payroll(p_staff_id text, data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(data->>'name');
  v_role text := trim(data->>'role');
  v_rate numeric := coalesce((data->>'dailyRate')::numeric, 0);
  v_days numeric := coalesce((data->>'daysWorked')::numeric, 0);
  v_advance numeric := coalesce((data->>'advance')::numeric, 0);
  v_debt numeric;
  v_commission numeric;
  v_expected numeric;
begin
  if v_name = '' then
    return jsonb_build_object('success', false, 'message', 'Name is required.');
  end if;
  if v_role = '' then
    return jsonb_build_object('success', false, 'message', 'Role is required.');
  end if;

  select coalesce(debt_charge, 0)
  into v_debt
  from payroll
  where staff_id = p_staff_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Staff not found.');
  end if;

  v_commission := get_staff_commission(v_name);
  v_expected := (v_rate * v_days) - v_advance + v_commission - v_debt;

  update payroll set
    name = v_name,
    role = v_role,
    days_worked = v_days,
    daily_rate = v_rate,
    advance = v_advance,
    expected_salary = v_expected
  where staff_id = p_staff_id;

  update staff set
    name = v_name,
    role = v_role
  where staff_id = p_staff_id;

  return jsonb_build_object('success', true, 'message', 'Payroll updated!');
end;
$$;

create or replace function delete_staff(p_staff_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from payroll where staff_id = p_staff_id;
  if not found then
    select name into v_name from staff where staff_id = p_staff_id;
  end if;

  if not found and v_name is null then
    return jsonb_build_object('success', false, 'message', 'Staff not found.');
  end if;

  if v_name is not null and v_name <> '' then
    update customers
    set point_person = ''
    where lower(trim(coalesce(point_person, ''))) = lower(trim(v_name));

    update pautang
    set point_person = ''
    where lower(trim(coalesce(point_person, ''))) = lower(trim(v_name));

    update logbook
    set point_person = ''
    where lower(trim(coalesce(point_person, ''))) = lower(trim(v_name));

    update commissions
    set point_person = ''
    where lower(trim(coalesce(point_person, ''))) = lower(trim(v_name));
  end if;

  delete from staff where staff_id = p_staff_id;

  return jsonb_build_object('success', true, 'message', 'Staff deleted and all records updated.');
end;
$$;

create or replace function update_days_worked(p_staff_id text, p_delta numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row payroll%rowtype;
  v_new_days numeric;
  v_commission numeric;
  v_expected numeric;
begin
  select * into v_row from payroll where staff_id = p_staff_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Staff not found.');
  end if;

  v_new_days := greatest(0, coalesce(v_row.days_worked, 0) + p_delta);
  v_commission := get_staff_commission(v_row.name);
  v_expected := (coalesce(v_row.daily_rate, 0) * v_new_days)
    - coalesce(v_row.advance, 0) + v_commission - coalesce(v_row.debt_charge, 0);

  update payroll set
    days_worked = v_new_days,
    expected_salary = v_expected
  where staff_id = p_staff_id;

  return jsonb_build_object(
    'success', true,
    'newDays', v_new_days,
    'expected', v_expected
  );
end;
$$;

create or replace function add_advance(p_staff_id text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row payroll%rowtype;
  v_new_advance numeric;
  v_commission numeric;
  v_expected numeric;
  v_shift_id text;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
  v_cd_id text;
begin
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid advance amount.');
  end if;

  select * into v_row from payroll where staff_id = p_staff_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Staff not found.');
  end if;

  v_shift_id := get_active_shift_id();
  v_new_advance := coalesce(v_row.advance, 0) + p_amount;
  v_commission := get_staff_commission(v_row.name);
  v_expected := (coalesce(v_row.daily_rate, 0) * coalesce(v_row.days_worked, 0))
    - v_new_advance + v_commission - coalesce(v_row.debt_charge, 0);

  update payroll set
    advance = v_new_advance,
    expected_salary = v_expected
  where staff_id = p_staff_id;

  v_cd_id := public.next_id('CD'::text);
  insert into cash_drawer (
    id, date, time, type, order_id, customer_id,
    description, amount, point_person, shift_id
  ) values (
    v_cd_id,
    v_date,
    v_time,
    'out',
    '',
    p_staff_id,
    'Advance - ' || v_row.name,
    p_amount,
    '',
    v_shift_id
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Advance recorded!',
    'newAdvance', v_new_advance,
    'expected', v_expected
  );
end;
$$;

create or replace function release_pay(p_staff_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row payroll%rowtype;
  v_expected numeric;
  v_shift_id text;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
  v_cd_id text;
begin
  select * into v_row from payroll where staff_id = p_staff_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Staff not found.');
  end if;

  v_expected := coalesce(v_row.expected_salary, 0);
  v_shift_id := get_active_shift_id();

  v_cd_id := public.next_id('CD'::text);
  insert into cash_drawer (
    id, date, time, type, order_id, customer_id,
    description, amount, point_person, shift_id
  ) values (
    v_cd_id,
    v_date,
    v_time,
    'out',
    '',
    p_staff_id,
    'Salary Release - ' || v_row.name,
    v_expected,
    v_row.name,
    v_shift_id
  );

  delete from pautang
  where lower(trim(coalesce(point_person, ''))) = lower(trim(v_row.name))
    and lower(coalesce(charge_status, 'No')) = 'yes';

  delete from commissions
  where lower(trim(coalesce(point_person, ''))) = lower(trim(v_row.name));

  update payroll set
    days_worked = 0,
    advance = 0,
    commission = 0,
    debt_charge = 0,
    expected_salary = 0,
    status = 'Pending',
    date_released = v_date,
    time_released = v_time
  where staff_id = p_staff_id;

  return jsonb_build_object('success', true, 'message', 'Salary released for ' || v_row.name || '!');
end;
$$;

create or replace function clear_payroll_rows(p_staff_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_count integer := 0;
begin
  if p_staff_ids is null or array_length(p_staff_ids, 1) is null then
    return jsonb_build_object('success', false, 'message', 'No rows selected.');
  end if;

  foreach v_id in array p_staff_ids
  loop
    update payroll set
      days_worked = 0,
      advance = 0,
      commission = 0,
      debt_charge = 0,
      expected_salary = 0,
      status = 'Pending'
    where staff_id = v_id;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', v_count || ' record(s) cleared.'
  );
end;
$$;

create or replace function charge_debts_for_staff(p_staff_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_count integer := 0;
  v_row record;
  v_cust_id text;
  v_cust_delta numeric;
  v_cust_deltas jsonb := '{}'::jsonb;
  v_pr_row payroll%rowtype;
  v_commission numeric;
  v_expected numeric;
  v_new_debt numeric;
begin
  if trim(coalesce(p_staff_name, '')) = '' then
    return jsonb_build_object('success', false, 'message', 'Staff name is required.');
  end if;

  for v_row in
    select pautang_id, customer_id, amount
    from pautang
    where lower(trim(coalesce(point_person, ''))) = lower(trim(p_staff_name))
      and lower(coalesce(charge_status, 'No')) <> 'yes'
  loop
    v_total := v_total + coalesce(v_row.amount, 0);
    v_count := v_count + 1;

    if v_row.customer_id is not null and v_row.customer_id <> '' then
      v_cust_id := v_row.customer_id;
      v_cust_delta := coalesce((v_cust_deltas->>v_cust_id)::numeric, 0) + coalesce(v_row.amount, 0);
      v_cust_deltas := jsonb_set(v_cust_deltas, array[v_cust_id], to_jsonb(v_cust_delta), true);
    end if;

    update pautang
    set charge_status = 'Yes'
    where pautang_id = v_row.pautang_id;
  end loop;

  if v_count = 0 then
    return jsonb_build_object('success', false, 'message', 'No uncharged debts found for ' || p_staff_name || '.');
  end if;

  for v_cust_id, v_cust_delta in
    select key, (value)::numeric from jsonb_each_text(v_cust_deltas)
  loop
    update customers
    set utang = greatest(0, coalesce(utang, 0) - v_cust_delta)
    where customer_id = v_cust_id;
  end loop;

  select * into v_pr_row
  from payroll
  where lower(trim(name)) = lower(trim(p_staff_name))
  limit 1;

  if found then
    v_new_debt := coalesce(v_pr_row.debt_charge, 0) + v_total;
    v_commission := get_staff_commission(v_pr_row.name);
    v_expected := (coalesce(v_pr_row.daily_rate, 0) * coalesce(v_pr_row.days_worked, 0))
      - coalesce(v_pr_row.advance, 0) + v_commission - v_new_debt;

    update payroll set
      debt_charge = v_new_debt,
      expected_salary = v_expected
    where staff_id = v_pr_row.staff_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', v_count || ' debt(s) charged (₱' || to_char(v_total, 'FM999999990.00') || ') to ' || p_staff_name || '.',
    'total', v_total,
    'count', v_count
  );
end;
$$;

grant execute on function get_staff_commission(text) to anon;
grant execute on function add_staff(jsonb) to anon;
grant execute on function update_payroll(text, jsonb) to anon;
grant execute on function delete_staff(text) to anon;
grant execute on function update_days_worked(text, numeric) to anon;
grant execute on function add_advance(text, numeric) to anon;
grant execute on function release_pay(text) to anon;
grant execute on function clear_payroll_rows(text[]) to anon;
grant execute on function charge_debts_for_staff(text) to anon;
