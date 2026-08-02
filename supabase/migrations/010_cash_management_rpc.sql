-- Payment categories (was PropertiesService in GAS)
create table if not exists payment_categories (
  name text primary key
);
insert into payment_categories (name) values
  ('Utilities'), ('Repairs and Maintenance'), ('Taxes and Licences'), ('Miscellaneous')
on conflict do nothing;

alter table payment_categories enable row level security;
create policy "anon full access" on payment_categories for all to anon using (true) with check (true);

-- ── Cash transfer between any two accounts ──
create or replace function cash_transfer(p_from text, p_to text, p_amount numeric, p_description text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric; v_id text; v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  select balance into v_bal from cash_accounts where name = p_from;
  if v_bal is null then return jsonb_build_object('success', false, 'message', 'Source account not found.'); end if;
  if v_bal < p_amount then return jsonb_build_object('success', false, 'message', 'Insufficient balance in ' || p_from || '.'); end if;

  v_id := public.next_id('TXN');
  insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, status)
  values (v_id, v_date, v_time, 'Transfer', p_from, p_to, p_amount, '', coalesce(p_description, ''), 'Verified');
  update cash_accounts set balance = balance - p_amount where name = p_from;
  update cash_accounts set balance = balance + p_amount where name = p_to;
  return jsonb_build_object('success', true, 'message', 'Transfer recorded!');
end; $$;

-- ── Cash -> Bank deposit ──
create or replace function cash_deposit(
  p_bank_account text, p_amount numeric, p_reference text default '', p_description text default '',
  p_account_number text default '', p_account_name text default ''
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric; v_id text; v_desc text; v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  select balance into v_bal from cash_accounts where name = 'Cash';
  if v_bal is null or v_bal < p_amount then return jsonb_build_object('success', false, 'message', 'Insufficient cash on hand.'); end if;

  v_desc := coalesce(p_description, '');
  if p_account_number <> '' then
    v_desc := v_desc || case when v_desc <> '' then ' | ' else '' end || 'To: ****' || p_account_number
      || case when p_account_name <> '' then ' (' || p_account_name || ')' else '' end;
  end if;

  v_id := public.next_id('TXN');
  insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, status)
  values (v_id, v_date, v_time, 'Deposit', 'Cash', p_bank_account, p_amount, coalesce(p_reference, ''), v_desc, 'Verified');
  update cash_accounts set balance = balance - p_amount where name = 'Cash';
  update cash_accounts set balance = balance + p_amount where name = p_bank_account;
  return jsonb_build_object('success', true, 'message', 'Deposit recorded!');
end; $$;

-- ── Bank withdraw ──
create or replace function bank_withdraw(p_bank_account text, p_amount numeric, p_reference text default '', p_description text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric; v_id text; v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  select balance into v_bal from cash_accounts where name = p_bank_account;
  if v_bal is null or v_bal < p_amount then return jsonb_build_object('success', false, 'message', 'Insufficient balance in ' || p_bank_account || '.'); end if;

  v_id := public.next_id('TXN');
  insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, status)
  values (v_id, v_date, v_time, 'Withdraw', p_bank_account, '', p_amount, coalesce(p_reference, ''), coalesce(p_description, ''), 'Verified');
  update cash_accounts set balance = balance - p_amount where name = p_bank_account;
  return jsonb_build_object('success', true, 'message', 'Withdrawal recorded!');
end; $$;

-- ── Bank payment (with optional transfer fee) ──
create or replace function bank_payment(
  p_bank_account text, p_category text, p_amount numeric, p_transfer_fee numeric default 0,
  p_reference text default '', p_description text default '',
  p_dest_bank text default '', p_dest_acc_num text default '', p_dest_acc_name text default ''
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric; v_id text; v_total numeric; v_desc text; v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  v_total := p_amount + coalesce(p_transfer_fee, 0);
  select balance into v_bal from cash_accounts where name = p_bank_account;
  if v_bal is null or v_bal < v_total then return jsonb_build_object('success', false, 'message', 'Insufficient balance in ' || p_bank_account || '.'); end if;

  v_desc := coalesce(p_description, '');
  if p_dest_bank <> '' then
    v_desc := v_desc || case when v_desc <> '' then ' | ' else '' end || 'To: ' || p_dest_bank
      || case when p_dest_acc_num <> '' then ' ****' || p_dest_acc_num else '' end
      || case when p_dest_acc_name <> '' then ' (' || p_dest_acc_name || ')' else '' end;
  end if;

  v_id := public.next_id('TXN');
  insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, status)
  values (v_id, v_date, v_time, 'Payment', p_bank_account, p_category, v_total, coalesce(p_reference, ''), v_desc, 'Verified');
  update cash_accounts set balance = balance - v_total where name = p_bank_account;
  return jsonb_build_object('success', true, 'message', 'Payment recorded!');
end; $$;

-- ── External funds added to a bank ──
create or replace function bank_add_funds(p_bank_account text, p_source text, p_amount numeric, p_reference text default '', p_description text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id text; v_desc text; v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  v_desc := coalesce(nullif(p_description, ''), 'External funds from ' || p_source);
  v_id := public.next_id('TXN');
  insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, status)
  values (v_id, v_date, v_time, 'Add', p_source, p_bank_account, p_amount, coalesce(p_reference, ''), v_desc, 'Verified');
  update cash_accounts set balance = balance + p_amount where name = p_bank_account;
  return jsonb_build_object('success', true, 'message', 'Funds added to ' || p_bank_account || '!');
end; $$;

-- ── Petty cash out (expense) ──
create or replace function petty_cash_out(p_from_account text, p_amount numeric, p_description text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric; v_id text; v_desc text; v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  select balance into v_bal from cash_accounts where name = p_from_account;
  if v_bal is null or v_bal < p_amount then return jsonb_build_object('success', false, 'message', 'Insufficient balance in ' || p_from_account || '.'); end if;

  v_desc := coalesce(nullif(p_description, ''), 'Cash out from ' || p_from_account);
  v_id := public.next_id('TXN');
  insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, status)
  values (v_id, v_date, v_time, 'Cash Out', p_from_account, '', p_amount, '', v_desc, 'Verified');
  update cash_accounts set balance = balance - p_amount where name = p_from_account;
  return jsonb_build_object('success', true, 'message', 'Cash out recorded from ' || p_from_account || '!');
end; $$;

-- ── Verify a closed shift's declared cash, add to Cash on Hand ──
create or replace function verify_shift_cash(p_shift_id text, p_verified_count numeric, p_remarks text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id text; v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  v_id := public.next_id('TXN');
  insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, shift_id, status)
  values (v_id, v_date, v_time, 'Sales', 'POS', 'Cash', p_verified_count, '', 'Shift ' || p_shift_id || ' verified', p_shift_id, 'Verified');
  update cash_accounts set balance = balance + p_verified_count where name = 'Cash';
  update day_report set verified = true, verified_count = p_verified_count, remarks = p_remarks where shift_id = p_shift_id;
  return jsonb_build_object('success', true, 'message', 'Shift ' || p_shift_id || ' verified! ₱' || to_char(p_verified_count, 'FM999999999.00') || ' added to Cash.');
end; $$;

-- ── Save/lock bank reconciliation (upsert on month+bank, blocks re-edit once locked) ──
create or replace function save_bank_reconciliation(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_month text := payload->>'month';
  v_bank text := coalesce(payload->>'selectedBank', '');
  v_book_ending numeric := coalesce((payload->>'bookEnding')::numeric, 0);
  v_interest numeric := coalesce((payload->>'interestIncome')::numeric, 0);
  v_unrecorded numeric := coalesce((payload->>'unrecordedDeposit')::numeric, 0);
  v_correction numeric := coalesce((payload->>'correction')::numeric, 0);
  v_book_notes text := coalesce(payload->>'bookNotes', '');
  v_bank_ending numeric := coalesce((payload->>'bankEndingBalance')::numeric, 0);
  v_deposit_transit numeric := coalesce((payload->>'depositInTransit')::numeric, 0);
  v_bank_notes text := coalesce(payload->>'bankNotes', '');
  v_book_total numeric; v_bank_total numeric; v_existing bank_reconciliation%rowtype;
  v_id text; v_cur_bal numeric; v_diff numeric; v_tx_id text;
  v_now timestamptz := now();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_time time := (v_now at time zone 'Asia/Manila')::time;
begin
  v_book_total := v_book_ending + v_interest + v_unrecorded - v_correction;
  v_bank_total := v_bank_ending + v_deposit_transit;

  if abs(v_book_total - v_bank_total) > 0.01 then
    return jsonb_build_object('success', false, 'message', 'Cannot save — Book and Bank totals do not match.');
  end if;

  select * into v_existing from bank_reconciliation where month = v_month and selected_bank = v_bank;

  if found then
    if v_existing.is_balanced then
      return jsonb_build_object('success', false, 'message', 'Reconciliation for ' || v_bank || ' (' || v_month || ') is already locked.');
    end if;
    update bank_reconciliation set
      book_ending_balance = v_book_ending, interest_income = v_interest, unrecorded_deposit = v_unrecorded,
      correction = v_correction, book_notes = v_book_notes, bank_ending_balance = v_bank_ending,
      deposit_in_transit = v_deposit_transit, bank_notes = v_bank_notes,
      book_total = v_book_total, bank_total = v_bank_total, is_balanced = true, saved_at = v_now
    where reconcile_id = v_existing.reconcile_id;
  else
    v_id := public.next_id('REC');
    insert into bank_reconciliation (
      reconcile_id, month, book_ending_balance, interest_income, unrecorded_deposit, correction,
      book_notes, bank_ending_balance, deposit_in_transit, bank_notes, book_total, bank_total,
      is_balanced, saved_at, selected_bank
    ) values (
      v_id, v_month, v_book_ending, v_interest, v_unrecorded, v_correction,
      v_book_notes, v_bank_ending, v_deposit_transit, v_bank_notes, v_book_total, v_bank_total,
      true, v_now, v_bank
    );
  end if;

  select balance into v_cur_bal from cash_accounts where name = v_bank;
  if v_cur_bal is not null then
    v_diff := v_bank_total - v_cur_bal;
    if abs(v_diff) >= 0.01 then
      v_tx_id := public.next_id('TXN');
      insert into cash_transactions (tx_id, date, time, type, from_account, to_account, amount, reference_number, description, status)
      values (
        v_tx_id, v_date, v_time,
        case when v_diff > 0 then 'Deposit' else 'Withdraw' end,
        case when v_diff > 0 then 'Bank Reconciliation' else v_bank end,
        case when v_diff > 0 then v_bank else 'Bank Reconciliation' end,
        abs(v_diff), '', 'Bank reconciliation adjustment for ' || v_bank, 'Verified'
      );
      update cash_accounts set balance = balance + v_diff where name = v_bank;
    end if;
  end if;

  return jsonb_build_object('success', true, 'message', 'Reconciliation saved and locked!');
end; $$;

grant execute on function cash_transfer(text, text, numeric, text) to anon;
grant execute on function cash_deposit(text, numeric, text, text, text, text) to anon;
grant execute on function bank_withdraw(text, numeric, text, text) to anon;
grant execute on function bank_payment(text, text, numeric, numeric, text, text, text, text, text) to anon;
grant execute on function bank_add_funds(text, text, numeric, text, text) to anon;
grant execute on function petty_cash_out(text, numeric, text) to anon;
grant execute on function verify_shift_cash(text, numeric, text) to anon;
grant execute on function save_bank_reconciliation(jsonb) to anon;