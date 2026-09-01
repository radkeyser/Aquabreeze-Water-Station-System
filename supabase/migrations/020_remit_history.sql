create table if not exists remit_history (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  customer_name text,
  point_person text,
  amount numeric not null,
  payment_method text not null default 'Cash',
  label text not null default 'Pautang Payment', -- 'Remit' or 'Pautang Payment'
  date date not null,
  time time,
  created_at timestamptz default now()
);

alter table remit_history enable row level security;
create policy "anon and authenticated full access" on remit_history
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on remit_history to anon;
grant select, insert, update, delete on remit_history to authenticated;

create or replace function remit_order_payment(p_order_id text, p_amount numeric, p_payment_method text default 'Cash')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row pautang%rowtype;
  v_pay numeric;
  v_cd_id text;
  v_tx_id text;
  v_shift_id text;
  v_method text := case when p_payment_method = 'GCash' then 'GCash' else 'Cash' end;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
  v_same_day boolean;
  v_label text;
  v_desc_prefix text;
begin
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid amount.');
  end if;

  select * into v_row from pautang where order_id = p_order_id limit 1;
  if not found then
    return jsonb_build_object('success', false, 'message', 'No outstanding balance found for this order.');
  end if;

  v_pay := least(p_amount, v_row.amount);
  v_same_day := (v_row.date = v_date);
  v_label := case when v_same_day then 'Remit' else 'Pautang Payment' end;
  v_desc_prefix := v_label || ' - ';

  v_shift_id := get_active_shift_id();

  if v_pay >= v_row.amount then
    delete from pautang where pautang_id = v_row.pautang_id;
    if v_row.customer_id is not null then
      update customers set utang = greatest(0, utang - v_row.amount) where customer_id = v_row.customer_id;
    else
      update customers set utang = greatest(0, utang - v_row.amount) where lower(trim(name)) = lower(trim(v_row.customer_name));
    end if;
  else
    update pautang set amount = amount - v_pay, status = 'Partial' where pautang_id = v_row.pautang_id;
    if v_row.customer_id is not null then
      update customers set utang = greatest(0, utang - v_pay) where customer_id = v_row.customer_id;
    else
      update customers set utang = greatest(0, utang - v_pay) where lower(trim(name)) = lower(trim(v_row.customer_name));
    end if;
  end if;

  v_cd_id := public.next_id('CD'::text);
  insert into cash_drawer (
    id, date, time, type, order_id, customer_id,
    description, amount, point_person, shift_id, pautang_id, payment_method
  ) values (
    v_cd_id, v_date, v_time, 'in', p_order_id, v_row.customer_id,
    v_desc_prefix || v_row.customer_name, v_pay, v_row.point_person, v_shift_id, v_row.pautang_id, v_method
  );

  if v_method = 'GCash' then
    v_tx_id := public.next_id('TXN'::text);
    insert into cash_transactions (
      tx_id, date, time, type, from_account, to_account,
      amount, reference_number, description, shift_id, status
    ) values (
      v_tx_id, v_date, v_time, 'Payment', null, 'ACC-000003',
      v_pay, p_order_id, 'GCash ' || lower(v_desc_prefix) || v_row.customer_name, v_shift_id, 'Verified'
    );
    update cash_accounts set balance = balance + v_pay where account_id = 'ACC-000003';
  end if;

  insert into remit_history (order_id, customer_name, point_person, amount, payment_method, label, date, time)
  values (p_order_id, v_row.customer_name, v_row.point_person, v_pay, v_method, v_label, v_date, v_time);

  return jsonb_build_object('success', true, 'message', case when v_same_day then 'Remit recorded!' else 'Payment recorded!' end);
end;
$$;

grant execute on function remit_order_payment(text, numeric, text) to anon;
grant execute on function remit_order_payment(text, numeric, text) to authenticated;