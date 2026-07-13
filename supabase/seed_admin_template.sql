-- Run after creating an Auth user via Dashboard > Authentication > Add user.
-- Fill in the values below, then run in the SQL Editor.

insert into users (id, name, email, role, is_active)
values (
  '00000000-0000-0000-0000-000000000000', -- User UID from Authentication > Users
  'Your Name',
  'you@example.com', -- must match the Auth user's email
  'admin',
  true
);
