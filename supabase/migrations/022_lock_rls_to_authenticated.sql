-- 022_lock_rls_to_authenticated.sql
-- Removes anon table/RPC access. Requires a real Supabase Auth session
-- (Google OAuth) AND an entry in authorized_users to read/write anything.
-- Defensive: skips any table/function that doesn't actually exist in this
-- database instead of erroring out, so it's safe to run even if the live
-- schema has drifted slightly from the committed migration history.

-- =========================================================
-- 1. Helper: is the current request from a logged-in,
--    allowlisted user?
-- =========================================================
create or replace function is_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'authenticated'
    and exists (
      select 1
      from authorized_users au
      where au.email ilike (auth.jwt() ->> 'email')
    );
$$;

grant execute on function is_authorized() to authenticated;
revoke execute on function is_authorized() from anon;

-- =========================================================
-- 2. Lock down authorized_users itself.
--    Users may only read their OWN row (needed for login check).
-- =========================================================
alter table authorized_users enable row level security;

drop policy if exists "anon full access" on authorized_users;
drop policy if exists "authenticated full access" on authorized_users;
drop policy if exists "self read" on authorized_users;

create policy "self read" on authorized_users
  for select to authenticated
  using (email ilike (auth.jwt() ->> 'email'));

revoke all on authorized_users from anon;
grant select on authorized_users to authenticated;

-- =========================================================
-- 3. Re-point every business table: anon -> authenticated + allowlisted
--    Skips any table name not present in this database.
-- =========================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'id_tracker','roles','expense_suggestions','staff','products','suppliers',
      'customers','shift','day_report','sales','commissions','cash_drawer',
      'pautang','slim_poly','prod_count','borrowed','daily_inventory','delivery',
      'meter_reading','payroll','cash_accounts','cash_transactions',
      'bank_reconciliation','logbook','processed_requests','payment_categories',
      'payroll_history','remit_history'
    ])
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'skipping missing table: %', t;
      continue;
    end if;

    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon full access" on %I', t);
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format('drop policy if exists "authorized full access" on %I', t);

    execute format(
      'create policy "authorized full access" on %I for all to authenticated using (is_authorized()) with check (is_authorized())',
      t
    );

    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- =========================================================
-- 4. Re-point every RPC grant: anon -> authenticated
--    Skips any function signature not present in this database.
--    (These are SECURITY DEFINER and still need an internal
--    is_authorized() check — see the follow-up migration.)
-- =========================================================
do $$
declare
  f text;
  f_regproc regprocedure;
begin
  for f in
    select unnest(array[
      'pay_pautang(text[], numeric)',
      'update_pautang_point_person(text[], text)',
      'get_active_shift_id()',
      'complete_sale_batch(jsonb)',
      'add_customer(jsonb)',
      'update_customer(text, jsonb)',
      'delete_customer(text)',
      'process_return(jsonb)',
      'get_staff_commission(text)',
      'add_staff(jsonb)',
      'update_payroll(text, jsonb)',
      'delete_staff(text)',
      'update_days_worked(text, numeric)',
      'add_advance(text, numeric)',
      'release_pay(text)',
      'clear_payroll_rows(text[])',
      'charge_debts_for_staff(text)',
      'add_product(jsonb)',
      'update_product(text, jsonb)',
      'delete_product(text)',
      'add_supplier(jsonb)',
      'update_supplier(text, jsonb)',
      'delete_supplier(text)',
      'save_config_data(jsonb)',
      'toggle_tip_claimed(text)',
      'mark_logbook_delivered(text, text, numeric)',
      'void_logbook_order(text, text)',
      'update_logbook_point_person(text, text, text)',
      'split_logbook_partial_reassign(text, text, text)',
      'save_daily_inventory(date, jsonb)',
      'save_delivery(jsonb)',
      'save_meter_reading(jsonb)',
      'cash_transfer(text, text, numeric, text)',
      'cash_deposit(text, numeric, text, text, text, text)',
      'bank_withdraw(text, numeric, text, text)',
      'bank_payment(text, text, numeric, numeric, text, text, text, text, text)',
      'bank_add_funds(text, text, numeric, text, text)',
      'petty_cash_out(text, numeric, text)',
      'verify_shift_cash(text, numeric, text)',
      'save_bank_reconciliation(jsonb)',
      'recompute_staff_commissions(text, text)',
      'set_hours_worked(text, numeric)',
      'get_effective_commission_rate(text, text)',
      'start_shift(numeric)',
      'end_shift(numeric)',
      'get_day_report_for_shift(text)',
      'remit_order_payment(text, numeric, text)',
      'next_id(text)'
    ])
  loop
    begin
      f_regproc := ('public.' || f)::regprocedure;
    exception when undefined_function then
      raise notice 'skipping missing function: %', f;
      continue;
    end;

    execute format('revoke execute on function %s from anon', f_regproc);
    execute format('grant execute on function %s to authenticated', f_regproc);
  end loop;
end $$;

-- =========================================================
-- 5. Report anything left over that still grants to anon,
--    so you can eyeball what (if anything) this script missed
--    due to a naming/signature mismatch.
-- =========================================================
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    raise notice 'STILL GRANTED TO ANON: %(%)', r.proname, r.args;
  end loop;
end $$;