-- PMIBD Expense Management System — initial schema
-- Run this once in the Supabase Dashboard: Project > SQL Editor > New query > paste > Run.

create extension if not exists pgcrypto;

create type user_role as enum (
  'submitter',
  'portfolio_director',
  'finance_director',
  'president',
  'admin'
);

create type expense_status as enum (
  'draft',
  'submitted',
  'pending_approval',
  'returned',
  'rejected',
  'approved',
  'paid'
);

create type payment_method as enum (
  'cheque',
  'bank_transfer',
  'cash'
);

create type approval_action as enum (
  'approve',
  'reject',
  'return',
  'comment'
);

-- Reference tables ------------------------------------------------------

create table portfolios (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'submitter',
  portfolio_id uuid references portfolios (id),
  is_active boolean not null default true
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  portfolio_id uuid not null references portfolios (id)
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_category_id uuid references expense_categories (id)
);

-- Transactional tables (✱ audit columns) ---------------------------------

create table expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  portfolio_id uuid not null references portfolios (id),
  event_id uuid references events (id),
  category_id uuid not null references expense_categories (id),
  description text not null,
  vendor text,
  payment_method payment_method not null,
  amount numeric(12, 2) not null check (amount > 0),
  status expense_status not null default 'draft',
  submitted_by uuid not null references users (id),
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

create table expense_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses (id) on delete cascade,
  file_url text not null,
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

create table expense_approvals (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses (id) on delete cascade,
  approver_id uuid not null references users (id),
  action approval_action not null,
  comment text,
  acted_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

create table approval_matrix (
  id uuid primary key default gen_random_uuid(),
  min_amount numeric(12, 2) not null,
  max_amount numeric(12, 2),
  required_role user_role not null,
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references users (id),
  timestamp timestamptz not null default now(),
  details jsonb
);

-- Keep updated_at / updated_by current on every row update ---------------

create function set_updated_columns()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger set_updated_columns before update on expenses
  for each row execute function set_updated_columns();
create trigger set_updated_columns before update on expense_documents
  for each row execute function set_updated_columns();
create trigger set_updated_columns before update on expense_approvals
  for each row execute function set_updated_columns();
create trigger set_updated_columns before update on approval_matrix
  for each row execute function set_updated_columns();

-- Row Level Security ------------------------------------------------------
-- Baseline only: any authenticated (logged-in) user can read/write.
-- Replace with role- and ownership-scoped policies when the approval
-- workflow feature is built (e.g. submitters only edit their own drafts,
-- approvers only act on expenses routed to their role).

alter table portfolios enable row level security;
alter table users enable row level security;
alter table events enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table expense_documents enable row level security;
alter table expense_approvals enable row level security;
alter table approval_matrix enable row level security;
alter table audit_log enable row level security;

create policy "authenticated read/write" on portfolios
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on users
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on events
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on expense_categories
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on expenses
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on expense_documents
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on expense_approvals
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on approval_matrix
  for all to authenticated using (true) with check (true);
create policy "authenticated read/write" on audit_log
  for all to authenticated using (true) with check (true);
