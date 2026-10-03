-- Booth registration
-- Adds the money-in side the app has never had: an exhibitor books a booth
-- at an event, and every payment received against that booking is recorded
-- as its own row, so a part-paid booth shows what is still outstanding.
-- Run in the SQL Editor after 0015_allow_cheque_number_on_paid.sql.
--
-- Three tables:
--   * booth_packages  - the booth tiers on offer at one event (name, price,
--     how many exist). Per-event reference data.
--   * booth_bookings  - who booked, for which event, at what price, and
--     where it stands (reserved / confirmed / cancelled).
--   * booth_payments  - money received against a booking. Reuses the
--     existing payment_method enum, so a booth paid by cheque records its
--     cheque number the same way an expense does.
--
-- Amount paid is deliberately NOT a column on booth_bookings: it is summed
-- from booth_payments wherever it is shown, so the two can never disagree.
--
-- Access model, following 0007_role_scoped_rls.sql:
--   * booth_packages: everyone reads, only admins manage - the same
--     treatment as events and expense_categories.
--   * booth_bookings: readable org-wide (like expenses); any authenticated
--     user registers one under their own name and can keep correcting it
--     while it is still 'reserved'; finance_director/admin can correct one
--     at any point, and only they can confirm it.
--   * booth_payments: recording received money is finance_director/admin
--     only - the same pair that marks an expense paid.
--   * Nothing here can be deleted. A booking that falls through is
--     cancelled; a payment entered in error is corrected by an admin.
--
-- Every object uses "if not exists" and every "create policy" is preceded
-- by a matching "drop policy if exists", so this file is safe to re-run
-- regardless of how far an earlier attempt got before failing.

-- Enums --------------------------------------------------------------------
-- No "create type if not exists" in Postgres, hence the guard.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'booth_booking_status') then
    create type booth_booking_status as enum (
      'reserved',
      'confirmed',
      'cancelled'
    );
  end if;
end $$;

-- Tables -------------------------------------------------------------------

create table if not exists booth_packages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null check (price >= 0),
  -- Null means "as many as we can fit" - the app shows remaining capacity
  -- only when a number is set.
  total_booths integer check (total_booths > 0),
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

create table if not exists booth_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id),
  -- Nullable: a one-off or negotiated booth doesn't have to match a
  -- package, and the price lives on the booking either way so changing a
  -- package's price later never rewrites what was already agreed.
  package_id uuid references booth_packages (id),
  organization_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  booth_number text,
  amount numeric(12, 2) not null check (amount >= 0),
  status booth_booking_status not null default 'reserved',
  remarks text,
  -- Who the booking belongs to, as submitted_by is on expenses. created_by
  -- stays separate so an admin entering one on someone's behalf is still
  -- recorded as the person who typed it.
  registered_by uuid not null default auth.uid() references users (id),
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

create table if not exists booth_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booth_bookings (id) on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  method payment_method not null,
  -- Cheque number, bank transaction id, or receipt number, depending on
  -- the method.
  reference text,
  remarks text,
  created_by uuid not null default auth.uid() references users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references users (id),
  updated_at timestamptz not null default now()
);

-- Indexes ------------------------------------------------------------------

create index if not exists booth_packages_event_id_idx
  on booth_packages (event_id);
create index if not exists booth_bookings_event_id_idx
  on booth_bookings (event_id);
create index if not exists booth_payments_booking_id_idx
  on booth_payments (booking_id);

-- A booth number can only be handed to one live booking per event; a
-- cancelled booking releases its number for someone else.
create unique index if not exists booth_bookings_event_booth_number_key
  on booth_bookings (event_id, booth_number)
  where booth_number is not null and status <> 'cancelled';

-- Keep updated_at / updated_by current, reusing 0001's trigger function ----

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_updated_columns' and tgrelid = 'booth_packages'::regclass
  ) then
    create trigger set_updated_columns before update on booth_packages
      for each row execute function set_updated_columns();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_updated_columns' and tgrelid = 'booth_bookings'::regclass
  ) then
    create trigger set_updated_columns before update on booth_bookings
      for each row execute function set_updated_columns();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_updated_columns' and tgrelid = 'booth_payments'::regclass
  ) then
    create trigger set_updated_columns before update on booth_payments
      for each row execute function set_updated_columns();
  end if;
end $$;

-- Integrity rules RLS can't express ----------------------------------------
-- RLS's WITH CHECK can't compare old and new values or look at another
-- table, so these two guards live in triggers, as guard_expense_status_update
-- does for expenses.

create or replace function guard_booth_booking_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  received numeric(12, 2);
begin
  if is_admin() then
    return new;
  end if;

  -- Confirming a booking says the money side is agreed, so it belongs to
  -- Finance, the same role that marks an expense paid.
  if new.status is distinct from old.status
    and new.status = 'confirmed'
    and current_user_role() <> 'finance_director'
  then
    raise exception 'Only Finance or an administrator can confirm a booking';
  end if;

  -- The agreed price can be renegotiated, but never below what the
  -- exhibitor has already paid - that would leave a phantom overpayment.
  if new.amount is distinct from old.amount then
    select coalesce(sum(amount), 0) into received
      from booth_payments where booking_id = old.id;

    if new.amount < received then
      raise exception
        'Booking amount (%) cannot be below the % already received',
        new.amount, received;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_booth_booking_update on booth_bookings;
create trigger guard_booth_booking_update
  before update on booth_bookings
  for each row execute function guard_booth_booking_update();

create or replace function guard_booth_payment_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from booth_bookings
    where id = new.booking_id and status = 'cancelled'
  ) then
    raise exception 'Cannot record a payment against a cancelled booking';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_booth_payment_booking on booth_payments;
create trigger guard_booth_payment_booking
  before insert or update on booth_payments
  for each row execute function guard_booth_payment_booking();

-- Row Level Security -------------------------------------------------------

alter table booth_packages enable row level security;
alter table booth_bookings enable row level security;
alter table booth_payments enable row level security;

-- booth_packages: everyone reads; only admins manage.

drop policy if exists "read booth packages" on booth_packages;
create policy "read booth packages" on booth_packages
  for select to authenticated using (true);

drop policy if exists "admins manage booth packages" on booth_packages;
create policy "admins manage booth packages" on booth_packages
  for all to authenticated using (is_admin()) with check (is_admin());

-- booth_bookings: everyone reads; anyone registers one under their own
-- name; the registrar keeps editing it only while it is still reserved,
-- Finance and admins at any point. No deletes - cancel instead.

drop policy if exists "read booth bookings" on booth_bookings;
create policy "read booth bookings" on booth_bookings
  for select to authenticated using (true);

drop policy if exists "register booth bookings" on booth_bookings;
create policy "register booth bookings" on booth_bookings
  for insert to authenticated
  with check (registered_by = auth.uid() or is_admin());

drop policy if exists "update booth bookings" on booth_bookings;
create policy "update booth bookings" on booth_bookings
  for update to authenticated
  using (
    is_admin()
    or current_user_role() = 'finance_director'
    or (registered_by = auth.uid() and status = 'reserved')
  )
  with check (
    is_admin()
    or current_user_role() = 'finance_director'
    or registered_by = auth.uid()
  );

-- booth_payments: everyone reads (a booking's balance is shown wherever
-- the booking is); only Finance and admins record or correct one.

drop policy if exists "read booth payments" on booth_payments;
create policy "read booth payments" on booth_payments
  for select to authenticated using (true);

drop policy if exists "finance records booth payments" on booth_payments;
create policy "finance records booth payments" on booth_payments
  for insert to authenticated
  with check (is_admin() or current_user_role() = 'finance_director');

drop policy if exists "finance corrects booth payments" on booth_payments;
create policy "finance corrects booth payments" on booth_payments
  for update to authenticated
  using (is_admin() or current_user_role() = 'finance_director')
  with check (is_admin() or current_user_role() = 'finance_director');
