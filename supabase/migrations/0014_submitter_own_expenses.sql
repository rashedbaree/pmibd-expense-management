-- Scopes submitters down to only their own expenses, rather than their
-- whole portfolio's. Submitters don't need to see what teammates in the
-- same portfolio submitted; portfolio_director/finance_director/president
-- still see their portfolio (or everything, per 0008_full_visibility.sql's
-- role/portfolio full-visibility toggles) since they act on the whole
-- team's expenses. Matches the app-level filtering in
-- src/lib/visibility.ts (getVisibilityScope/scopeExpenseQuery) - this
-- migration is the corresponding database-level enforcement, since the
-- read policies from 0008_full_visibility.sql are otherwise the only thing
-- stopping a submitter from reading every portfolio member's expenses
-- directly via the Supabase client.
-- Run in the SQL Editor after 0013_budget_validation.sql.
--
-- Written to be safely re-runnable if an earlier attempt only partially
-- applied.

create or replace function has_expense_read_access(expense expenses)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    has_full_expense_visibility()
    or is_assigned_approver(expense)
    or (
      current_user_role() = 'submitter'
      and expense.submitted_by = auth.uid()
    )
    or (
      current_user_role() <> 'submitter'
      and expense.portfolio_id = current_user_portfolio()
    );
$$;

drop policy if exists "read expenses" on expenses;
create policy "read expenses" on expenses
  for select to authenticated using (has_expense_read_access(expenses));

drop policy if exists "read expense documents" on expense_documents;
create policy "read expense documents" on expense_documents
  for select to authenticated using (
    exists (
      select 1 from expenses e
      where e.id = expense_id and has_expense_read_access(e)
    )
  );

drop policy if exists "read expense approvals" on expense_approvals;
create policy "read expense approvals" on expense_approvals
  for select to authenticated using (
    exists (
      select 1 from expenses e
      where e.id = expense_id and has_expense_read_access(e)
    )
  );
