-- Allow the app to read/write without login.
-- The frontend uses the Supabase publishable (anon) key with no auth flow.
-- Replace authenticated-only RLS policies with open access for anon.

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
      'bank_reconciliation','logbook','processed_requests'
    ])
  loop
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format('drop policy if exists "anon full access" on %I', t);

    execute format(
      'create policy "anon full access" on %I for all to anon using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- Checkout RPC used by POS
grant execute on function complete_sale_batch(jsonb) to anon;
grant execute on function get_active_shift_id() to anon;
