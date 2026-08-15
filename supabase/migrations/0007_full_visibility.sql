-- Restricts expense visibility to a user's own portfolio by default, with
-- admin-configurable exceptions: specific roles (e.g. President) or specific
-- portfolios (e.g. Finance & Audit) can be marked to see every portfolio's
-- expenses instead of just their own. Applies to Dashboard, Reports, and the
-- Expenses list. Run in the SQL Editor after 0006_bank_transactions.sql.
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

do $$ begin
  create policy "authenticated read/write" on role_full_visibility
    for all to authenticated using (true) with check (true);
exception
  when duplicate_object then null;
end $$;

update portfolios set full_visibility = true where name = 'Finance & Audit';
