create table if not exists payroll_history (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null,
  staff_name text not null,
  role text,
  days_worked numeric,
  daily_rate numeric,
  advance numeric,
  commission numeric,
  debt_charge numeric,
  sss numeric,
  pagibig numeric,
  philhealth numeric,
  expected_salary numeric,
  released_pautang jsonb,
  released_commissions jsonb,
  date_released date not null,
  time_released time,
  created_at timestamptz default now()
);

alter table payroll_history enable row level security;
create policy "authenticated full access" on payroll_history
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on payroll_history to authenticated;
grant execute on function next_id(text) to authenticated;