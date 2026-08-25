-- Configurable approval chain
-- Lets an admin configure the ordered sequence of roles an expense routes
-- through for approval (Admin -> Approval Flow), instead of the previously
-- hardcoded finance_director -> president chain in src/lib/approval.ts.
-- Run in the SQL Editor after 0009_resubmit_returned.sql.

create table if not exists approval_chain_steps (
  id uuid primary key default gen_random_uuid(),
  step_order int not null,
  role user_role not null check (role in ('portfolio_director', 'finance_director', 'president')),
  created_at timestamptz not null default now()
);

-- Seed with the existing hardcoded chain, but only if the table is empty -
-- if this has already been run (or an admin has since configured a
-- different chain), leave it alone.
insert into approval_chain_steps (step_order, role)
select seed.step_order, seed.role
from (
  values (1, 'finance_director'::user_role), (2, 'president'::user_role)
) as seed (step_order, role)
where not exists (select 1 from approval_chain_steps);

alter table approval_chain_steps enable row level security;

-- Everyone reads (the submission/approval flow depends on it client- and
-- server-side); only admins manage it - same pattern as approval_matrix.
drop policy if exists "read approval chain" on approval_chain_steps;
create policy "read approval chain" on approval_chain_steps
  for select to authenticated using (true);

drop policy if exists "admins manage approval chain" on approval_chain_steps;
create policy "admins manage approval chain" on approval_chain_steps
  for all to authenticated using (is_admin()) with check (is_admin());
