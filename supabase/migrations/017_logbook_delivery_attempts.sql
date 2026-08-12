alter table logbook
  add column if not exists delivery_attempts integer not null default 0;

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
  v_attempts integer;
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

  v_attempts := v_row.delivery_attempts + case when p_status = 'Delivered' then 1 else 0 end;

  update logbook
  set
    status = p_status,
    delivered_time = case when p_status in ('Delivered','Partial') then v_time else null end,
    delivered_date = case when p_status in ('Delivered','Partial') then v_date else null end,
    qty_delivered = v_dqty,
    delivery_attempts = v_attempts
  where log_id = p_log_id;

  update commissions
  set delivered = p_status
  where order_id = v_row.order_id
    and lower(trim(coalesce(point_person, ''))) = lower(trim(coalesce(v_row.point_person, '')))
    and lower(trim(product)) = lower(trim(v_row.product));

  return jsonb_build_object(
    'success', true,
    'deliveredTime', case when p_status in ('Delivered','Partial') then v_time::text else '' end,
    'deliveredDate', case when p_status in ('Delivered','Partial') then v_date::text else '' end,
    'deliveryAttempts', v_attempts
  );
end;
$$;

grant execute on function mark_logbook_delivered(text, text, numeric) to anon;