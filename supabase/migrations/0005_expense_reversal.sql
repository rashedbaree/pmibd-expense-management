-- Adds support for reversing an expense that didn't actually go through
-- (e.g. a payment that bounced or an event that was cancelled), and for
-- recording standalone historical corrections via bulk import.
-- Run in the SQL Editor after 0004_cheque_number.sql.
--
-- A reversal is stored as its own expense row (entry_type = 'reversal') that
-- carries the same positive amount (the `amount > 0` check on expenses is
-- unchanged — sign is conveyed by entry_type, not by the number itself) and,
-- when created in-app via the Reverse button, points back at the original
-- via reverses_expense_id. Bulk-imported reversals may leave
-- reverses_expense_id null — historical data often has no clean 1:1 mapping
-- back to a specific original row (e.g. cheque_number covers many line
-- items), so linkage is optional there, not required.

-- Every statement below is written to be safely re-runnable: if an earlier
-- attempt partially applied this file (e.g. the SQL Editor stopped partway
-- through after an error), re-running it from the top just skips whatever
-- already exists instead of erroring.

do $$ begin
  create type expense_entry_type as enum ('expense', 'reversal');
exception
  when duplicate_object then null;
end $$;

alter table expenses
  add column if not exists entry_type expense_entry_type not null default 'expense',
  add column if not exists reverses_expense_id uuid references expenses (id);

do $$ begin
  alter table expenses
    add constraint expenses_reversal_reference_chk check (
      reverses_expense_id is null or entry_type = 'reversal'
    );
exception
  when duplicate_object then null;
end $$;

-- When a reversal does link back to a specific original, that original can
-- only be reversed once.
create unique index if not exists expenses_reverses_expense_id_key
  on expenses (reverses_expense_id)
  where reverses_expense_id is not null;
