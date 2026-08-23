-- Lets a submitter edit and resubmit their own returned expense, rather
-- than only being able to start over with a brand-new submission.
-- Run in the SQL Editor after 0008_full_visibility.sql.
--
-- Two things had to change to allow this:
--   1. RLS only let the currently-assigned approver (or admin) update an
--      expense at all - a submitter editing their own returned row wasn't
--      covered by any existing UPDATE policy.
--   2. guard_expense_status_update() (0007_role_scoped_rls.sql) blocks any
--      non-admin change beyond status/current_approver_role, specifically
--      to stop an approver tampering with amount/description/etc. while
--      approving. That's still correct for approvers - but a submitter
--      resubmitting needs to be able to fix exactly those fields, so the
--      guard now carves out that one case: their own row, moving from
--      returned to pending_approval, submitted_by unchanged.

drop policy if exists "resubmit own returned expense" on expenses;
create policy "resubmit own returned expense" on expenses
  for update to authenticated
  using (submitted_by = auth.uid() and status = 'returned')
  with check (submitted_by = auth.uid());

create or replace function guard_expense_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if old.status = 'returned' and old.submitted_by = auth.uid() then
    if new.submitted_by is distinct from old.submitted_by then
      raise exception 'submitted_by cannot be changed when resubmitting';
    end if;
    if new.status <> 'pending_approval' then
      raise exception 'Resubmitting a returned expense must set status to pending_approval';
    end if;
    return new;
  end if;

  if new.date is distinct from old.date
    or new.portfolio_id is distinct from old.portfolio_id
    or new.event_id is distinct from old.event_id
    or new.category_id is distinct from old.category_id
    or new.description is distinct from old.description
    or new.vendor is distinct from old.vendor
    or new.payment_method is distinct from old.payment_method
    or new.amount is distinct from old.amount
    or new.submitted_by is distinct from old.submitted_by
    or new.remarks is distinct from old.remarks
    or new.required_approval_role is distinct from old.required_approval_role
    or new.cheque_number is distinct from old.cheque_number
    or new.entry_type is distinct from old.entry_type
    or new.reverses_expense_id is distinct from old.reverses_expense_id
  then
    raise exception 'Only status and current_approver_role can be changed by this action';
  end if;

  return new;
end;
$$;
