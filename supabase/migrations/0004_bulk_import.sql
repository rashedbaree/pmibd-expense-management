-- Adds fields needed for bulk-importing historical expenses from CSV/Excel
-- (cheque number for matching against bank statements, entry_type to record
-- historical reversal/correction rows). Run in the SQL Editor after
-- 0003_seed_reference_data.sql.

create type expense_entry_type as enum (
  'expense',
  'reversal'
);

alter table expenses
  add column cheque_number text,
  add column entry_type expense_entry_type not null default 'expense';
