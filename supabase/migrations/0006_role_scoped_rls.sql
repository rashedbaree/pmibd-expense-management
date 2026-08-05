-- Replaces the blanket "any authenticated user can read/write everything"
-- policies from 0001_init.sql (and 0005's bank_statement_lines policy) with
-- role-scoped policies that match the application's actual access model.
-- Run in the SQL Editor after 0005_bank_statement.sql.
--
-- Access model:
--   * Reference data (portfolios, expense_categories, events, users,
--     approval_matrix) is readable by everyone; only admins manage it.
--   * expenses/expense_documents/expense_approvals are readable by everyone
--     (matches the existing org-wide dashboard/reports/expenses list).
--   * Writing an expense's status is restricted to whoever is currently
--     assigned to act on it (current_approver_role), scoped to their own
--     portfolio for portfolio_directors; finance_director/admin can mark an
--     approved expense as paid; admins can correct anything.
--   * Nobody can delete an expense — financial records are correctable, not
--     deletable.
--   * audit_log is append-only: anyone can log their own actions, only
--     admins can read the trail, nobody can edit/delete entries.
--   * bank_statement_lines is admin-only in both directions, matching the
--     /admin/reconciliation page being admin-gated.
--
-- Two real gaps this closes beyond just "matching the UI": the previous
-- schema let any authenticated user call markAsPaid or the admin
-- add/delete actions directly (bypassing the UI's role check, since those
-- server actions don't re-check role themselves) — those are now enforced
-- at the database level too.

-- Helper functions -----------------------------------------------------
-- SECURITY DEFINER so a policy on `users` can read `users` without
-- recursing into RLS on itself.

create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid();
$$;

create or replace function current_user_portfolio()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select portfolio_id from users where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  );
$$;

-- RLS's WITH CHECK can't compare old vs new column values, so a trigger
-- guards that approval/payment updates only ever touch status and
-- current_approver_role — not amount, submitted_by, etc. Admins are exempt.

create or replace function guard_expense_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.date is distinct from old.date
    or new.portfolio_id is distinct from old.portfolio_id
    or new.event_id is distinct from old.event_id
    or new.category_id is distinct from old.category_id
    or new.description is distinct from old.description
    or new.vendor is distinct from old.vendor
    or new.payment_method is distinct from old.payment_method
    or new.amount is distinct from old.amount
    or new.submitted_by is distinct from old.submitted_by
    or new.remarks is distinct from old.remarks
    or new.required_approval_role is distinct from old.required_approval_role
    or new.cheque_number is distinct from old.cheque_number
    or new.entry_type is distinct from old.entry_type
  then
    raise exception 'Only status and current_approver_role can be changed by this action';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_expense_status_update on expenses;
create trigger guard_expense_status_update
  before update on expenses
  for each row execute function guard_expense_status_update();

-- Drop the old blanket policies ------------------------------------------

drop policy if exists "authenticated read/write" on portfolios;
drop policy if exists "authenticated read/write" on users;
drop policy if exists "authenticated read/write" on events;
drop policy if exists "authenticated read/write" on expense_categories;
drop policy if exists "authenticated read/write" on expenses;
drop policy if exists "authenticated read/write" on expense_documents;
drop policy if exists "authenticated read/write" on expense_approvals;
drop policy if exists "authenticated read/write" on approval_matrix;
drop policy if exists "authenticated read/write" on audit_log;
drop policy if exists "authenticated read/write" on bank_statement_lines;

-- portfolios: everyone reads; only admins manage --------------------------

create policy "read portfolios" on portfolios
  for select to authenticated using (true);
create policy "admins add portfolios" on portfolios
  for insert to authenticated with check (is_admin());
create policy "admins update portfolios" on portfolios
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete portfolios" on portfolios
  for delete to authenticated using (is_admin());

-- users: everyone reads (names/roles are used throughout the app); only
-- admins create or edit accounts (no self-registration).

create policy "read users" on users
  for select to authenticated using (true);
create policy "admins add users" on users
  for insert to authenticated with check (is_admin());
create policy "admins update users" on users
  for update to authenticated using (is_admin()) with check (is_admin());

-- events: everyone reads; only admins manage ------------------------------

create policy "read events" on events
  for select to authenticated using (true);
create policy "admins add events" on events
  for insert to authenticated with check (is_admin());
create policy "admins update events" on events
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete events" on events
  for delete to authenticated using (is_admin());

-- expense_categories: everyone reads; only admins manage ------------------

create policy "read expense categories" on expense_categories
  for select to authenticated using (true);
create policy "admins add expense categories" on expense_categories
  for insert to authenticated with check (is_admin());
create policy "admins update expense categories" on expense_categories
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete expense categories" on expense_categories
  for delete to authenticated using (is_admin());

-- approval_matrix: everyone reads; only admins manage ---------------------

create policy "read approval matrix" on approval_matrix
  for select to authenticated using (true);
create policy "admins add approval matrix" on approval_matrix
  for insert to authenticated with check (is_admin());
create policy "admins update approval matrix" on approval_matrix
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete approval matrix" on approval_matrix
  for delete to authenticated using (is_admin());

-- expenses -----------------------------------------------------------------
-- Read: everyone (matches the existing org-wide dashboard/reports/list).
-- Insert: submitters create their own; admins can import on anyone's behalf.
-- Update: the assigned approver acts on their queue (portfolio_directors
-- limited to their own portfolio); finance_director/admin mark an approved
-- expense paid; admins can correct anything. The trigger above stops
-- non-admins from changing any field but status/current_approver_role.
-- Delete: nobody.

create policy "read expenses" on expenses
  for select to authenticated using (true);

create policy "submit own expenses" on expenses
  for insert to authenticated
  with check (submitted_by = auth.uid() or is_admin());

create policy "act on assigned expenses" on expenses
  for update to authenticated
  using (
    is_admin()
    or (
      current_approver_role = current_user_role()
      and (
        current_user_role() <> 'portfolio_director'
        or portfolio_id = current_user_portfolio()
      )
    )
    or (status = 'approved' and current_user_role() = 'finance_director')
  )
  with check (true);

-- expense_documents: everyone reads; only the submitter (or admin) attaches
-- documents to their own expense.

create policy "read expense documents" on expense_documents
  for select to authenticated using (true);

create policy "attach documents to own expenses" on expense_documents
  for insert to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from expenses e
      where e.id = expense_id and e.submitted_by = auth.uid()
    )
  );

-- expense_approvals: everyone reads (it's the audit trail for decisions);
-- only the currently assigned approver can record a decision, matching
-- what actOnExpense checks in the app.

create policy "read expense approvals" on expense_approvals
  for select to authenticated using (true);

create policy "assigned approver records decision" on expense_approvals
  for insert to authenticated
  with check (
    approver_id = auth.uid()
    and exists (
      select 1 from expenses e
      where e.id = expense_id
        and e.current_approver_role = current_user_role()
        and (
          current_user_role() <> 'portfolio_director'
          or e.portfolio_id = current_user_portfolio()
        )
    )
  );

-- audit_log: append-only. Anyone can log their own actions; only admins
-- can read the trail; nobody can edit or delete entries.

create policy "admins read audit log" on audit_log
  for select to authenticated using (is_admin());

create policy "log own actions" on audit_log
  for insert to authenticated
  with check (actor_id = auth.uid());

-- bank_statement_lines: admin-only, matching /admin/reconciliation.

create policy "admins read bank statement lines" on bank_statement_lines
  for select to authenticated using (is_admin());
create policy "admins add bank statement lines" on bank_statement_lines
  for insert to authenticated with check (is_admin());
create policy "admins update bank statement lines" on bank_statement_lines
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admins delete bank statement lines" on bank_statement_lines
  for delete to authenticated using (is_admin());
