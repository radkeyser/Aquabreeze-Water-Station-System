-- Settings: products, suppliers, roles & expense suggestions
-- Requires: next_id() from main schema

create or replace function add_product(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_name text := trim(data->>'name');
begin
  if v_name = '' then
    return jsonb_build_object('success', false, 'message', 'Product name is required.');
  end if;

  v_id := public.next_id('PROD'::text);
  insert into products (product_id, name, price, type, commission_rate, pickup_price)
  values (
    v_id,
    v_name,
    coalesce((data->>'price')::numeric, 0),
    coalesce(nullif(data->>'type', ''), 'Product'),
    coalesce((data->>'commissionRate')::numeric, 0),
    coalesce((data->>'pickupPrice')::numeric, 0)
  );

  return jsonb_build_object('success', true, 'message', v_name || ' added!', 'productId', v_id);
end;
$$;

create or replace function update_product(p_product_id text, data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update products set
    name = trim(data->>'name'),
    price = coalesce((data->>'price')::numeric, 0),
    type = coalesce(nullif(data->>'type', ''), 'Product'),
    commission_rate = coalesce((data->>'commissionRate')::numeric, 0),
    pickup_price = coalesce((data->>'pickupPrice')::numeric, 0)
  where product_id = p_product_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Product not found.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Product updated!');
end;
$$;

create or replace function delete_product(p_product_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from products where product_id = p_product_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Product not found.');
  end if;
  return jsonb_build_object('success', true, 'message', 'Product deleted.');
end;
$$;

create or replace function add_supplier(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_name text := trim(data->>'name');
begin
  if v_name = '' then
    return jsonb_build_object('success', false, 'message', 'Supplier name is required.');
  end if;

  v_id := public.next_id('SUP'::text);
  insert into suppliers (
    supplier_id, supplier_name,
    qty_500ml, price_500ml,
    qty_1000ml, price_1000ml,
    qty_slim_gallon, price_slim_gallon
  ) values (
    v_id,
    v_name,
    coalesce((data->>'qty500')::numeric, 0),
    coalesce((data->>'price500')::numeric, 0),
    coalesce((data->>'qty1000')::numeric, 0),
    coalesce((data->>'price1000')::numeric, 0),
    coalesce((data->>'qtyGallon')::numeric, 0),
    coalesce((data->>'priceGallon')::numeric, 0)
  );

  return jsonb_build_object('success', true, 'message', v_name || ' added!', 'supplierId', v_id);
end;
$$;

create or replace function update_supplier(p_supplier_id text, data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update suppliers set
    supplier_name = trim(data->>'name'),
    qty_500ml = coalesce((data->>'qty500')::numeric, 0),
    price_500ml = coalesce((data->>'price500')::numeric, 0),
    qty_1000ml = coalesce((data->>'qty1000')::numeric, 0),
    price_1000ml = coalesce((data->>'price1000')::numeric, 0),
    qty_slim_gallon = coalesce((data->>'qtyGallon')::numeric, 0),
    price_slim_gallon = coalesce((data->>'priceGallon')::numeric, 0)
  where supplier_id = p_supplier_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Supplier not found.');
  end if;

  return jsonb_build_object('success', true, 'message', 'Supplier updated!');
end;
$$;

create or replace function delete_supplier(p_supplier_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from suppliers where supplier_id = p_supplier_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Supplier not found.');
  end if;
  return jsonb_build_object('success', true, 'message', 'Supplier deleted.');
end;
$$;

create or replace function save_config_data(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_expense text;
  v_keep_roles text[];
  v_keep_expenses text[];
begin
  v_keep_roles := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(coalesce(payload->'roles', '[]'::jsonb)) as t(x)),
    array[]::text[]
  );
  v_keep_expenses := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(coalesce(payload->'expenses', '[]'::jsonb)) as t(x)),
    array[]::text[]
  );

  foreach v_role in array v_keep_roles
  loop
    if v_role is not null and trim(v_role) <> '' then
      insert into roles (name) values (trim(v_role)) on conflict (name) do nothing;
    end if;
  end loop;

  delete from roles r
  where not (r.name = any(v_keep_roles))
    and not exists (select 1 from staff s where s.role = r.name);

  delete from expense_suggestions;

  foreach v_expense in array v_keep_expenses
  loop
    if v_expense is not null and trim(v_expense) <> '' then
      insert into expense_suggestions (name) values (trim(v_expense)) on conflict (name) do nothing;
    end if;
  end loop;

  return jsonb_build_object('success', true, 'message', 'Config saved!');
end;
$$;

grant execute on function add_product(jsonb) to anon;
grant execute on function update_product(text, jsonb) to anon;
grant execute on function delete_product(text) to anon;
grant execute on function add_supplier(jsonb) to anon;
grant execute on function update_supplier(text, jsonb) to anon;
grant execute on function delete_supplier(text) to anon;
grant execute on function save_config_data(jsonb) to anon;
