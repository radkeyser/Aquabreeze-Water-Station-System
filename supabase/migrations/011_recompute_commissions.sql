-- Recompute all existing commission rows for a staff member when their
-- salary type changes, using their new effective rate per product.
create or replace function recompute_staff_commissions(p_staff_name text, p_new_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_row staff%rowtype;
  v_row record;
  v_new_rate numeric;
  v_updated integer := 0;
begin
  select * into v_staff_row from staff where lower(trim(name)) = lower(trim(p_staff_name)) limit 1;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Staff not found.');
  end if;

  for v_row in
    select c.id as commission_id, c.quantity, s.product_id
    from commissions c
    join sales s on s.order_id = c.order_id
    where lower(trim(c.point_person)) = lower(trim(p_staff_name))
  loop
    if p_new_type = 'Commission-Based' then
      v_new_rate := case v_row.product_id
        when 'PROD-000001' then coalesce(v_staff_row.commission_5gal, 0)
        when 'PROD-000002' then coalesce(v_staff_row.commission_1000ml, 0)
        when 'PROD-000004' then coalesce(v_staff_row.commission_500ml, 0)
        when 'PROD-000005' then coalesce(v_staff_row.commission_slim, 0)
        else 0
      end;
    else
      select coalesce(commission_rate, 0) into v_new_rate
      from products where product_id = v_row.product_id;
      v_new_rate := coalesce(v_new_rate, 0);
    end if;

    update commissions
    set total_commission = v_new_rate * coalesce(v_row.quantity, 0)
    where id = v_row.commission_id;

    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object('success', true, 'updated', v_updated);
end;
$$;

grant execute on function recompute_staff_commissions(text, text) to anon;