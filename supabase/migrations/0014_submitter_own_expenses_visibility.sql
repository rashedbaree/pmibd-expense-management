-- Lets the `submitter` role read (and print reports on) expenses they
-- personally submitted, across every portfolio - submitters have no single
-- portfolio_id and are expected to enter expenses on behalf of any
-- portfolio. This is deliberately narrower than "full visibility": a
-- submitter should see only what they themselves entered, not every other
-- submitter's or portfolio director's expenses, while roles flagged in
-- role_full_visibility (e.g. President) continue to see everything.
--
-- Extends the "read expenses" / "read expense documents" / "read expense
-- approvals" policies from 0008_full_visibility.sql with a
-- `submitted_by = auth.uid()` escape hatch, mirroring the same check
-- 0007_role_scoped_rls.sql already uses on the expenses INSERT policy.
-- (The Unpaid Expenses Report at /reports/unpaid is unaffected - it was
-- already org-wide by design, independent of these read policies' portfolio
-- scoping, and the app now allows the submitter role onto that page.)
--
-- Written to be safely re-runnable.

drop policy if exists "read expenses" on expenses;
create policy "read expenses" on expenses
  for select to authenticated using (
    has_full_expense_visibility()
    or portfolio_id = current_user_portfolio()
    or is_assigned_approver(expenses)
    or submitted_by = auth.uid()
  );

drop policy if exists "read expense documents" on expense_documents;
create policy "read expense documents" on expense_documents
  for select to authenticated using (
    has_full_expense_visibility()
    or exists (
      select 1 from expenses e
      where e.id = expense_id
        and (
          e.portfolio_id = current_user_portfolio()
          or is_assigned_approver(e)
          or e.submitted_by = auth.uid()
        )
    )
  );

drop policy if exists "read expense approvals" on expense_approvals;
create policy "read expense approvals" on expense_approvals
  for select to authenticated using (
    has_full_expense_visibility()
    or exists (
      select 1 from expenses e
      where e.id = expense_id
        and (
          e.portfolio_id = current_user_portfolio()
          or is_assigned_approver(e)
          or e.submitted_by = auth.uid()
        )
    )
  );
