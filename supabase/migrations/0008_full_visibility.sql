-- Restricts expense visibility to a user's own portfolio by default, with
-- admin-configurable exceptions: specific roles (e.g. President) or specific
-- portfolios (e.g. Finance & Audit) can be marked to see every portfolio's
-- expenses instead of just their own. Applies to Dashboard, Reports, and the
-- Expenses list - and, below, to the actual database-level read policies on
-- expenses/expense_documents/expense_approvals, replacing the org-wide
-- "everyone reads everything" policies 0007_role_scoped_rls.sql set up.
-- Without this, the app's query-level filtering was the only thing
-- enforcing visibility - anyone with valid credentials could still read
-- every portfolio's expenses directly via the Supabase client.
-- Run in the SQL Editor after 0007_role_scoped_rls.sql.
--
-- Written to be safely re-runnable if an earlier attempt only partially
-- applied.

alter table portfolios add column if not exists full_visibility boolean not null default false;

create table if not exists role_full_visibility (
  role user_role primary key,
  full_visibility boolean not null default false
);

insert into role_full_visibility (role, full_visibility) values
  ('submitter', false),
  ('portfolio_director', false),
  ('finance_director', false),
  ('president', true),
  ('admin', true)
on conflict (role) do nothing;

alter table role_full_visibility enable row level security;

-- Everyone needs to read this (the app checks it for every user's own
-- visibility scope); only admins can change it - same pattern as every
-- other reference table in 0007_role_scoped_rls.sql.
do $$ begin
  create policy "read role visibility" on role_full_visibility
    for select to authenticated using (true);
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "admins update role visibility" on role_full_visibility
    for update to authenticated using (is_admin()) with check (is_admin());
exception
  when duplicate_object then null;
end $$;

update portfolios set full_visibility = true where name = 'Finance & Audit';

-- Replace 0007_role_scoped_rls.sql's org-wide "everyone reads every
-- portfolio's expenses" policies with ones that respect visibility scope.

create or replace function has_full_expense_visibility()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_admin()
    or exists (
      select 1 from role_full_visibility
      where role = current_user_role() and full_visibility
    )
    or exists (
      select 1 from portfolios
      where id = current_user_portfolio() and full_visibility
    );
$$;

-- An approver must be able to see (and thus act on) whatever's currently
-- routed to their role, regardless of portfolio visibility - mirrors the
-- "act on assigned expenses" UPDATE policy from 0007_role_scoped_rls.sql.
-- Without this, finance_director/president couldn't review expenses from
-- portfolios they don't have full visibility into, breaking the approval
-- chain for everyone but admins.

create or replace function is_assigned_approver(expense expenses)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      expense.current_approver_role = current_user_role()
      and (
        current_user_role() <> 'portfolio_director'
        or expense.portfolio_id = current_user_portfolio()
      )
    )
    -- finance_director marks any approved expense paid, even after
    -- current_approver_role has gone back to null - mirrors the same
    -- condition in the "act on assigned expenses" UPDATE policy.
    or (expense.status = 'approved' and current_user_role() = 'finance_director');
$$;

drop policy if exists "read expenses" on expenses;
create policy "read expenses" on expenses
  for select to authenticated using (
    has_full_expense_visibility()
    or portfolio_id = current_user_portfolio()
    or is_assigned_approver(expenses)
  );

drop policy if exists "read expense documents" on expense_documents;
create policy "read expense documents" on expense_documents
  for select to authenticated using (
    has_full_expense_visibility()
    or exists (
      select 1 from expenses e
      where e.id = expense_id
        and (e.portfolio_id = current_user_portfolio() or is_assigned_approver(e))
    )
  );

drop policy if exists "read expense approvals" on expense_approvals;
create policy "read expense approvals" on expense_approvals
  for select to authenticated using (
    has_full_expense_visibility()
    or exists (
      select 1 from expenses e
      where e.id = expense_id
        and (e.portfolio_id = current_user_portfolio() or is_assigned_approver(e))
    )
  );
