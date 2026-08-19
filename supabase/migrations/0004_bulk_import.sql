-- Adds fields needed for bulk-importing historical expenses from CSV/Excel
-- (cheque number for matching against bank statements, entry_type to record
-- historical reversal/correction rows). Run in the SQL Editor after
-- 0003_seed_reference_data.sql. Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_entry_type') then
    create type expense_entry_type as enum ('expense', 'reversal');
  end if;
end $$;

alter table expenses
  add column if not exists cheque_number text,
  add column if not exists entry_type expense_entry_type not null default 'expense';
