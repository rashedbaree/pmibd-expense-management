-- Adds fields needed to drive the approval workflow, plus a storage bucket
-- for expense supporting documents. Run in the SQL Editor after 0001_init.sql.

alter table expenses
  add column remarks text,
  add column required_approval_role user_role,
  add column current_approver_role user_role;

alter table expense_categories
  add constraint expense_categories_name_key unique (name);

-- Storage bucket for uploaded receipts/invoices ---------------------------

insert into storage.buckets (id, name, public)
values ('expense-documents', 'expense-documents', false)
on conflict (id) do nothing;

create policy "authenticated read expense documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'expense-documents');

create policy "authenticated upload expense documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-documents');
