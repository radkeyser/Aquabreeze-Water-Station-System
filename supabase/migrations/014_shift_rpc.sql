create or replace function start_shift(p_starting_cash numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shift_id text;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  update shift set status = 'Close' where status = 'Open';

  v_shift_id := public.next_id('SHF'::text);
  insert into shift (shift_id, date, time, status) values (v_shift_id, v_date, v_time, 'Open');

  insert into day_report (
    shift_id, starting_cash, cash_sales, added_cash, cash_expenses,
    expected_cash_amount, actual_cash_amount, verified, verified_count, remarks
  ) values (
    v_shift_id, coalesce(p_starting_cash, 0), 0, 0, 0, 0, 0, false, 0, ''
  );

  return jsonb_build_object('success', true, 'message', 'Shift started!', 'shiftId', v_shift_id);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end; $$;

create or replace function end_shift(p_actual_cash numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shift shift%rowtype;
  v_starting_cash numeric := 0;
  v_cash_sales numeric := 0;
  v_added_cash numeric := 0;
  v_cash_expenses numeric := 0;
  v_expected numeric;
  v_actual numeric := coalesce(p_actual_cash, 0);
  v_diff numeric;
  v_row record;
begin
  select * into v_shift from shift where status = 'Open' order by date desc, time desc limit 1;
  if not found then
    return jsonb_build_object('success', false, 'message', 'No active shift found.');
  end if;

  select coalesce(starting_cash, 0) into v_starting_cash from day_report where shift_id = v_shift.shift_id;

  for v_row in
    select type, description, amount
    from cash_drawer
    where shift_id = v_shift.shift_id
      and lower(coalesce(payment_method, 'Cash')) <> 'gcash'
  loop
    if lower(v_row.type) = 'in' then
      if lower(v_row.description) like 'cash added%' then
        v_added_cash := v_added_cash + coalesce(v_row.amount, 0);
      else
        v_cash_sales := v_cash_sales + coalesce(v_row.amount, 0);
      end if;
    else
      v_cash_expenses := v_cash_expenses + coalesce(v_row.amount, 0);
    end if;
  end loop;

  v_expected := v_starting_cash + v_cash_sales + v_added_cash - v_cash_expenses;
  v_diff := v_actual - v_expected;

  update shift set status = 'Close' where shift_id = v_shift.shift_id;

  -- Preserve verified / verified_count / remarks (owned by Cash Management's
  -- shift verification flow) — only overwrite the cash-count columns.
  update day_report set
    starting_cash = v_starting_cash,
    cash_sales = v_cash_sales,
    added_cash = v_added_cash,
    cash_expenses = v_cash_expenses,
    expected_cash_amount = v_expected,
    actual_cash_amount = v_actual
  where shift_id = v_shift.shift_id;

  return jsonb_build_object(
    'success', true, 'message', 'Shift ended.',
    'startingCash', v_starting_cash, 'cashSales', v_cash_sales, 'addedCash', v_added_cash,
    'cashExpenses', v_cash_expenses, 'expected', v_expected, 'actual', v_actual, 'difference', v_diff
  );
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end; $$;

create or replace function get_day_report_for_shift(p_shift_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_starting_cash numeric := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
  v_expected numeric;
  v_row record;
begin
  select coalesce(starting_cash, 0) into v_starting_cash from day_report where shift_id = p_shift_id;

  for v_row in
    select type, amount
    from cash_drawer
    where shift_id = p_shift_id
      and lower(coalesce(payment_method, 'Cash')) <> 'gcash'
  loop
    if lower(v_row.type) = 'in' then v_cash_in := v_cash_in + coalesce(v_row.amount, 0);
    else v_cash_out := v_cash_out + coalesce(v_row.amount, 0);
    end if;
  end loop;

  v_expected := v_starting_cash + v_cash_in - v_cash_out;

  return jsonb_build_object('startingCash', v_starting_cash, 'cashIn', v_cash_in, 'cashOut', v_cash_out, 'expected', v_expected);
end; $$;

grant execute on function start_shift(numeric) to anon;
grant execute on function end_shift(numeric) to anon;
grant execute on function get_day_report_for_shift(text) to anon;