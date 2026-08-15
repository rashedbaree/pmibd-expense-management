-- Storage for uploaded bank statement lines, ahead of a later reconciliation
-- pass against expenses. Run in the SQL Editor after 0005_expense_reversal.sql.
--
-- dedupe_key is a generated column combining every statement field, so
-- re-uploading the same statement (or an overlapping date range) is safe —
-- the unique index below makes duplicate rows a no-op insert conflict
-- instead of double-counting a transaction.

create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  trans_date date not null,
  cheque_number text,
  ref text,
  narration text,
  trans_details text,
  debit numeric(14, 2),
  credit numeric(14, 2),
  balance numeric(14, 2) not null,
  source_file text,
  dedupe_key text generated always as (
    lpad(extract(year from trans_date)::int::text, 4, '0') || '-' ||
    lpad(extract(month from trans_date)::int::text, 2, '0') || '-' ||
    lpad(extract(day from trans_date)::int::text, 2, '0') || '|' ||
    coalesce(cheque_number, '') || '|' ||
    coalesce(ref, '') || '|' ||
    coalesce(narration, '') || '|' ||
    coalesce(trans_details, '') || '|' ||
    coalesce(debit::text, '') || '|' ||
    coalesce(credit::text, '') || '|' ||
    balance::text
  ) stored,
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now()
);

create unique index bank_transactions_dedupe_key_key
  on bank_transactions (dedupe_key);

alter table bank_transactions enable row level security;

create policy "authenticated read/write" on bank_transactions
  for all to authenticated using (true) with check (true);
