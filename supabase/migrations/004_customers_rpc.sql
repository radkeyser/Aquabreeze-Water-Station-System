-- Customer CRUD + borrow return RPCs

create or replace function add_customer(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_name text := trim(data->>'name');
  v_location text := coalesce(trim(data->>'location'), '');
begin
  if v_name = '' then
    return jsonb_build_object('success', false, 'message', 'Customer name is required.');
  end if;

  if exists (
    select 1 from customers
    where lower(trim(name)) = lower(v_name)
      and lower(trim(coalesce(location, ''))) = lower(v_location)
  ) then
    return jsonb_build_object(
      'success', false,
      'message', 'A customer named "' || v_name || '" at "' || v_location || '" already exists.'
    );
  end if;

  v_id := public.next_id('CUST'::text);
  insert into customers (
    customer_id, name, location, point_person, utang, gallon, dispenser,
    override, override_5gal, override_500ml, override_1000ml
  ) values (
    v_id,
    v_name,
    v_location,
    coalesce(data->>'pointPerson', ''),
    0, 0, 0,
    coalesce((data->>'overrideOn')::boolean, false),
    case when coalesce((data->>'overrideOn')::boolean, false) then coalesce((data->>'override5gal')::numeric, 0) else 0 end,
    case when coalesce((data->>'overrideOn')::boolean, false) then coalesce((data->>'override500')::numeric, 0) else 0 end,
    case when coalesce((data->>'overrideOn')::boolean, false) then coalesce((data->>'override1000')::numeric, 0) else 0 end
  );

  return jsonb_build_object('success', true, 'message', v_name || ' added!', 'customerId', v_id);
end;
$$;

create or replace function update_customer(p_customer_id text, data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_name text;
  v_old_location text;
  v_new_name text := trim(data->>'name');
  v_new_location text := coalesce(trim(data->>'location'), '');
  v_override_on boolean := coalesce((data->>'overrideOn')::boolean, false);
begin
  select name, coalesce(location, '')
  into v_old_name, v_old_location
  from customers
  where customer_id = p_customer_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Customer not found.');
  end if;

  update customers set
    name = v_new_name,
    location = v_new_location,
    point_person = coalesce(data->>'pointPerson', ''),
    override = v_override_on,
    override_5gal = case when v_override_on then coalesce((data->>'override5gal')::numeric, 0) else 0 end,
    override_500ml = case when v_override_on then coalesce((data->>'override500')::numeric, 0) else 0 end,
    override_1000ml = case when v_override_on then coalesce((data->>'override1000')::numeric, 0) else 0 end
  where customer_id = p_customer_id;

  if v_new_name <> v_old_name then
    update sales
    set customer_name = v_new_name
    where lower(trim(customer_name)) = lower(trim(v_old_name))
      and lower(trim(coalesce(location, ''))) = lower(trim(v_old_location));

    update logbook
    set customer_name = v_new_name
    where lower(trim(customer_name)) = lower(trim(v_old_name))
      and lower(trim(coalesce(location, ''))) = lower(trim(v_old_location));

    update commissions
    set customer_name = v_new_name
    where lower(trim(customer_name)) = lower(trim(v_old_name))
      and lower(trim(coalesce(location, ''))) = lower(trim(v_old_location));

    update pautang
    set customer_name = v_new_name
    where customer_id = p_customer_id;
  end if;

  return jsonb_build_object('success', true, 'message', 'Customer updated!');
end;
$$;

create or replace function delete_customer(p_customer_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from customers where customer_id = p_customer_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Customer not found.');
  end if;
  return jsonb_build_object('success', true, 'message', 'Customer deleted.');
end;
$$;

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
  v_borrow_id text;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  if v_return_gallon <= 0 and v_return_dispenser <= 0 then
    return jsonb_build_object('success', false, 'message', 'No return quantity specified.');
  end if;

  update customers
  set
    gallon = greatest(0, gallon - v_return_gallon),
    dispenser = greatest(0, dispenser - v_return_dispenser)
  where customer_id = v_customer_id
     or lower(trim(name)) = lower(trim(v_customer_name));

  v_borrow_id := public.next_id('BRW'::text);
  insert into borrowed (
    borrow_id, date, time, customer_id, customer_name,
    gallon, dispenser, borrow_status, record_status
  ) values (
    v_borrow_id,
    v_date,
    v_time,
    v_customer_id,
    v_customer_name,
    case when v_return_gallon > 0 then -v_return_gallon else 0 end,
    case when v_return_dispenser > 0 then -v_return_dispenser else 0 end,
    'Returned',
    'No'
  );

  return jsonb_build_object('success', true, 'message', 'Return recorded successfully!');
end;
$$;

grant execute on function add_customer(jsonb) to anon;
grant execute on function update_customer(text, jsonb) to anon;
grant execute on function delete_customer(text) to anon;
grant execute on function process_return(jsonb) to anon;
