-- Adds a cheque number field, recorded when an approved expense is marked
-- as paid (or supplied directly for bulk-imported historical records).
-- Run in the Supabase Dashboard: Project > SQL Editor > New query > paste > Run.

alter table expenses add column cheque_number text;
