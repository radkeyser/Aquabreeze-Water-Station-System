-- Save daily inventory count: inserts one row per product, then marks
-- pending deliveries/sales/borrows as "recorded" so they don't double-count next time.
create or replace function save_daily_inventory(p_date date, p_products jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod text;
  v_data jsonb;
  v_record_id text;
  v_now timestamptz := now();
begin
  for v_prod, v_data in select * from jsonb_each(p_products)
  loop
    v_record_id := public.next_id('INV'::text);
    insert into daily_inventory (
      record_id, date, product, beginning_bag, beginning_bottle,
      delivery_bottles, available, sales_bottle, borrowed, returned,
      expected, actual_bag, actual_bottle, total_actual, variance,
      bag_size, timestamp, cooler_box, cooler_pcs, ice_maker_pcs, floor_breakdown
    ) values (
      v_record_id, p_date, v_prod,
      coalesce((v_data->>'begBag')::numeric, 0),
      coalesce((v_data->>'begBtl')::numeric, 0),
      coalesce((v_data->>'delBag')::numeric, 0),
      coalesce((v_data->>'available')::numeric, 0),
      coalesce((v_data->>'salesBtl')::numeric, 0),
      coalesce((v_data->>'borrowed')::numeric, 0),
      coalesce((v_data->>'returned')::numeric, 0),
      coalesce((v_data->>'expected')::numeric, 0),
      coalesce((v_data->>'actualBag')::numeric, 0),
      coalesce((v_data->>'actualBtl')::numeric, 0),
      coalesce((v_data->>'totalActual')::numeric, 0),
      coalesce((v_data->>'variance')::numeric, 0),
      coalesce((v_data->>'bagSize')::numeric, 1),
      v_now,
      coalesce((v_data->>'coolerBox')::numeric, 0),
      coalesce((v_data->>'coolerPcs')::numeric, 0),
      coalesce((v_data->>'iceMakerPcs')::numeric, 0),
      coalesce(v_data->'floorBreakdown', '{}'::jsonb)
    );
  end loop;

  update delivery set status = 'Recorded'
  where status <> 'Recorded' and date <= p_date;

  update sales set recorded = 'Yes'
  where coalesce(lower(recorded), 'no') <> 'yes';

  update borrowed set record_status = 'Yes'
  where coalesce(lower(record_status), 'no') <> 'yes';

  return jsonb_build_object('success', true, 'message', 'Inventory saved for ' || p_date::text);
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- Save a delivery record, and if paid by Cash, log a CashDrawer expense.
create or replace function save_delivery(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_discount numeric := coalesce((payload->>'discount')::numeric, 0);
  v_additional numeric := coalesce((payload->>'additional')::numeric, 0);
  v_total numeric := coalesce((payload->>'totalCost')::numeric, 0) - v_discount + v_additional;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
  v_cd_id text;
  v_shift_id text;
begin
  v_id := public.next_id('DEL'::text);

  insert into delivery (
    delivery_id, date, time, supplier, product, bags, piece_per_bag,
    discount, additional, total_cost, mop, notes, status
  ) values (
    v_id, (payload->>'date')::date, v_time, payload->>'supplier', payload->>'product',
    coalesce((payload->>'bags')::numeric, 0), coalesce((payload->>'piecePerBag')::numeric, 0),
    v_discount, v_additional, v_total, payload->>'mop', coalesce(payload->>'notes', ''),
    'Not Yet Recorded'
  );

  if lower(coalesce(payload->>'mop', '')) = 'cash' and v_total > 0 then
    v_shift_id := get_active_shift_id();
    v_cd_id := public.next_id('CD'::text);
    insert into cash_drawer (id, date, time, type, order_id, customer_id, description, amount, shift_id)
    values (v_cd_id, v_date, v_time, 'out', '', '', 'Inventory - ' || (payload->>'product'), v_total, v_shift_id);
  end if;

  return jsonb_build_object('success', true, 'message', 'Delivery recorded.');
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

-- Save a meter reading record and clear the SlimPoly tracking sheet.
create or replace function save_meter_reading(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_now timestamptz := now();
begin
  v_id := public.next_id('MTR'::text);

  insert into meter_reading (
    record_id, date, timestamp,
    stock_beg_poly, stock_end_poly, sold_poly,
    stock_beg_slim, stock_end_slim, sold_slim,
    ref_500_btl, ref_500_l, ref_1000_btl, ref_1000_l, bottle_total_l,
    gal_sold_poly, gal_unref_poly, gal_ref_poly, gal_lit_poly, conv_poly,
    gal_sold_slim, gal_unref_slim, gal_ref_slim, gal_lit_slim, conv_slim, gal_total_l,
    other_6l, other_7l, other_8l, other_10l, other_total_l,
    actual_refilled_l, meter_beg, meter_end, meter_expected, variance
  ) values (
    v_id, (payload->>'date')::date, v_now,
    coalesce((payload->>'stockBegPoly')::numeric,0), coalesce((payload->>'stockEndPoly')::numeric,0), coalesce((payload->>'soldPoly')::numeric,0),
    coalesce((payload->>'stockBegSlim')::numeric,0), coalesce((payload->>'stockEndSlim')::numeric,0), coalesce((payload->>'soldSlim')::numeric,0),
    coalesce((payload->>'ref500Btl')::numeric,0), coalesce((payload->>'ref500L')::numeric,0),
    coalesce((payload->>'ref1000Btl')::numeric,0), coalesce((payload->>'ref1000L')::numeric,0), coalesce((payload->>'bottleTotalL')::numeric,0),
    coalesce((payload->>'galSoldPoly')::numeric,0), coalesce((payload->>'galUnrefPoly')::numeric,0), coalesce((payload->>'galRefPoly')::numeric,0), coalesce((payload->>'galLitPoly')::numeric,0), coalesce((payload->>'convPoly')::numeric,19.2),
    coalesce((payload->>'galSoldSlim')::numeric,0), coalesce((payload->>'galUnrefSlim')::numeric,0), coalesce((payload->>'galRefSlim')::numeric,0), coalesce((payload->>'galLitSlim')::numeric,0), coalesce((payload->>'convSlim')::numeric,20.2), coalesce((payload->>'galTotalL')::numeric,0),
    coalesce((payload->>'other6L')::numeric,0), coalesce((payload->>'other7L')::numeric,0), coalesce((payload->>'other8L')::numeric,0), coalesce((payload->>'other10L')::numeric,0), coalesce((payload->>'otherTotalL')::numeric,0),
    coalesce((payload->>'actualRefilledL')::numeric,0), coalesce((payload->>'meterBeg')::numeric,0), coalesce((payload->>'meterEnd')::numeric,0), coalesce((payload->>'meterExpected')::numeric,0), coalesce((payload->>'variance')::numeric,0)
  );

  delete from slim_poly;

  return jsonb_build_object('success', true, 'message', 'Meter Reading saved for ' || (payload->>'date'));
exception when others then
  return jsonb_build_object('success', false, 'message', sqlerrm);
end;
$$;

grant execute on function save_daily_inventory(date, jsonb) to anon;
grant execute on function save_delivery(jsonb) to anon;
grant execute on function save_meter_reading(jsonb) to anon;