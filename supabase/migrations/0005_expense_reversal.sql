-- Adds the ability to link a reversal row (entry_type = 'reversal', added
-- by 0004_bulk_import.sql) back to the specific expense it reverses, for
-- reversals created in-app via the Reverse button. Bulk-imported reversals
-- may leave reverses_expense_id null - historical data often has no clean
-- 1:1 mapping back to a specific original row (e.g. cheque_number covers
-- many line items), so linkage is optional there, not required.
-- Run in the SQL Editor after 0004_bulk_import.sql.
--
-- Every statement below is written to be safely re-runnable: if an earlier
-- attempt partially applied this file (e.g. the SQL Editor stopped partway
-- through after an error), re-running it from the top just skips whatever
-- already exists instead of erroring.

alter table expenses
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
