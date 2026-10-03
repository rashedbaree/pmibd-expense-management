-- Event check-in: attendee list, QR check-in / gift-bag tracking, and the scan
-- history, used by the admin-only "Event check in" section of the app
-- (/event-checkin). Run in the SQL Editor after 0015_allow_cheque_number_on_paid.sql.
--
-- Originally built and run as a standalone app for the Bangladesh Project
-- Management Symposium 2026; folded into this app so it lives in one place,
-- behind the existing login and the admin role. Tables are prefixed
-- "checkin_" so they can't be mistaken for anything in the finance schema
-- (this database already has `users` and `events`).
--
-- Access model: administrators only, enforced by the database itself (RLS +
-- is_admin() from 0007_role_scoped_rls.sql) - not just by hiding the menu.
-- Nobody else can read or write either table, and the anon key can't see
-- them at all.
--
-- Safe to re-run: everything is "if not exists" / "drop policy if exists".
--
-- To remove it again (this deletes the attendee data):
--   drop table if exists checkin_scan_log;
--   drop table if exists checkin_attendees;

create table if not exists checkin_attendees (
  id              uuid primary key default gen_random_uuid(),
  ticket_number   text not null unique,           -- what the QR code contains
  confirmation    text,
  name            text not null,
  email           text,                           -- stored lower-case
  phone           text,
  organization    text,
  designation     text,
  ticket_type     text,                           -- Single / PmiMember / Deligate / Group / Walk-in ...
  source          text not null default 'import' check (source in ('import', 'walkin')),
  is_team         boolean not null default false, -- BOD / volunteer / speaker ...; independent of ticket_type
  team_role       text,                           -- shown when is_team
  checked_in_at   timestamptz,
  checked_in_by   text,
  bag_given_at    timestamptz,
  bag_given_by    text,
  pass_emailed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists checkin_attendees_email_idx   on checkin_attendees (email);
create index if not exists checkin_attendees_name_idx    on checkin_attendees (lower(name));
create index if not exists checkin_attendees_is_team_idx on checkin_attendees (is_team);

create table if not exists checkin_scan_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  ticket_number text not null,
  attendee_id   uuid references checkin_attendees (id) on delete set null,
  station       text not null check (station in ('checkin', 'bag')),
  result        text not null,                    -- ok / already / notfound / undo
  staff         text
);

alter table checkin_attendees enable row level security;
alter table checkin_scan_log  enable row level security;

drop policy if exists "admins manage checkin attendees" on checkin_attendees;
create policy "admins manage checkin attendees" on checkin_attendees
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admins manage checkin scan log" on checkin_scan_log;
create policy "admins manage checkin scan log" on checkin_scan_log
  for all to authenticated using (is_admin()) with check (is_admin());
