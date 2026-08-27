-- Budget periods
-- Splits budgets into named periods (e.g. "FY2026") with a real start/end
-- date, instead of one all-time bucket per portfolio+category. Lets next
-- year's budget be imported without blending into this year's numbers, and
-- lets Budget vs Actual compare a period's budget against only the actual
-- expenses dated within that period. Run in the SQL Editor after
-- 0011_budgets.sql.

create table if not exists budget_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now()
);

alter table budget_periods enable row level security;

drop policy if exists "read budget periods" on budget_periods;
create policy "read budget periods" on budget_periods
  for select to authenticated using (true);

drop policy if exists "admins manage budget periods" on budget_periods;
create policy "admins manage budget periods" on budget_periods
  for all to authenticated using (is_admin()) with check (is_admin());

-- Nullable at the DB level (safe to add even if budgets already has rows);
-- the app requires a period on every new import.
alter table budgets add column if not exists period_id uuid references budget_periods (id);
