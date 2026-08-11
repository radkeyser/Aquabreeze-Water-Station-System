create or replace function process_return(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id text := payload->>'customerId';
  v_customer_name text := coalesce(payload->>'customerName', '');
  v_return_gallon numeric := coalesce((payload->>'returnGallon')::numeric, 0);
  v_return_dispenser numeric := coalesce((payload->>'returnDispenser')::numeric, 0);
  v_gallon_type text := nullif(payload->>'gallonType', '');
  v_borrow_id text;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
  v_cust_id text;
begin
  if v_return_gallon <= 0 and v_return_dispenser <= 0 then
    return jsonb_build_object('success', false, 'message', 'No return quantity specified.');
  end if;

  select customer_id into v_cust_id
  from customers
  where customer_id = v_customer_id or lower(trim(name)) = lower(trim(v_customer_name))
  limit 1;

  update customers
  set
    gallon = greatest(0, gallon - v_return_gallon),
    dispenser = greatest(0, dispenser - v_return_dispenser),
    gallon_slim = case when v_gallon_type = 'Slim' then greatest(0, gallon_slim - v_return_gallon) else gallon_slim end,
    gallon_poly = case when v_gallon_type = 'Poly' then greatest(0, gallon_poly - v_return_gallon) else gallon_poly end
  where customer_id = v_cust_id;

  v_borrow_id := public.next_id('BRW'::text);
  insert into borrowed (
    borrow_id, date, time, customer_id, customer_name,
    gallon, dispenser, borrow_status, record_status, gallon_type
  ) values (
    v_borrow_id,
    v_date,
    v_time,
    v_cust_id,
    v_customer_name,
    case when v_return_gallon > 0 then -v_return_gallon else 0 end,
    case when v_return_dispenser > 0 then -v_return_dispenser else 0 end,
    'Returned',
    'No',
    v_gallon_type
  );

  return jsonb_build_object('success', true, 'message', 'Return recorded successfully!');
end;
$$;

grant execute on function process_return(jsonb) to anon;
grant execute on function process_return(jsonb) to authenticated;