-- Bank statement lines, imported from CSV/Excel and reconciled against
-- expenses.cheque_number. Run in the SQL Editor after 0004_bulk_import.sql.

create table bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  cheque_number text not null,
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  remarks text,
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

create trigger set_updated_columns before update on bank_statement_lines
  for each row execute function set_updated_columns();

alter table bank_statement_lines enable row level security;

create policy "authenticated read/write" on bank_statement_lines
  for all to authenticated using (true) with check (true);
