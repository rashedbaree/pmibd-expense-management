-- Starter reference data so the demo has something to pick from.
-- Safe to edit or skip — everything here is also manageable from /admin.

insert into portfolios (name) values
  ('Finance & Audit'),
  ('Membership'),
  ('Events'),
  ('Marketing & Communications'),
  ('Professional Development')
on conflict (name) do nothing;

insert into expense_categories (name) values
  ('Venue & Logistics'),
  ('Catering'),
  ('Travel & Transport'),
  ('Printing & Materials'),
  ('Speaker & Training Fees'),
  ('Marketing & Promotion'),
  ('Miscellaneous')
on conflict (name) do nothing;

-- No natural unique key on approval_matrix; only run this block once.
-- created_by defaults to auth.uid(), which is null when run from the SQL
-- Editor (no logged-in app session), so it's set explicitly here to an
-- existing admin user instead.
insert into approval_matrix (min_amount, max_amount, required_role, created_by)
select seed.min_amount, seed.max_amount, seed.required_role, admin.id
from (values
  (0::numeric, 10000::numeric, 'portfolio_director'::user_role),
  (10000.01, 50000, 'finance_director'),
  (50000.01, null, 'president')
) as seed (min_amount, max_amount, required_role)
cross join (select id from users where role = 'admin' limit 1) as admin
where not exists (select 1 from approval_matrix);
