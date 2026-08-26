-- Budget module
-- Lets an admin bulk-import the approved portfolio budgets (Admin -> Budgets)
-- and adds a Budget vs Actual report comparing them against real expenses,
-- so Finance/President can cross-check spending stays within what was
-- approved. Run in the SQL Editor after 0010_configurable_approval_chain.sql.

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios (id),
  category_id uuid not null references expense_categories (id),
  -- Free text, not a real date column: the source budget files use things
  -- like "Mar-Dec'26" or "April to November" rather than a single date, so
  -- this is kept for reference only and isn't used to filter the report.
  initiative_name text,
  planned_date text,
  amount numeric(12, 2) not null check (amount > 0),
  remarks text,
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_columns' and tgrelid = 'budgets'::regclass
  ) then
    create trigger set_updated_columns before update on budgets
      for each row execute function set_updated_columns();
  end if;
end $$;

alter table budgets enable row level security;

-- Everyone reads (the Budget vs Actual report checks role in the app, not
-- here); only admins manage it - same pattern as approval_chain_steps.
drop policy if exists "read budgets" on budgets;
create policy "read budgets" on budgets
  for select to authenticated using (true);

drop policy if exists "admins manage budgets" on budgets;
create policy "admins manage budgets" on budgets
  for all to authenticated using (is_admin()) with check (is_admin());
