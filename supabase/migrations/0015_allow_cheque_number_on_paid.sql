-- Fixes markAsPaid: finance_director/admin marking an approved expense paid
-- couldn't set a cheque number. guard_expense_status_update() (0007/0009)
-- blocks any non-admin update that changes cheque_number, with no carve-out
-- for the approved -> paid transition - unlike the "resubmit own returned
-- expense" carve-out already present for submitters. Leaving cheque_number
-- blank worked (no change = not "distinct"), entering one raised
-- "Only status and current_approver_role can be changed by this action",
-- silently failing since markAsPaid didn't check the update's error either
-- (fixed separately in src/app/(app)/approvals/actions.ts).
-- Run in the SQL Editor after 0014_submitter_own_expenses.sql.
--
-- Written to be safely re-runnable if an earlier attempt only partially
-- applied.

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

  if old.status = 'approved' and new.status = 'paid' then
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
      or new.entry_type is distinct from old.entry_type
      or new.reverses_expense_id is distinct from old.reverses_expense_id
    then
      raise exception 'Only status, current_approver_role, and cheque_number can be changed when marking paid';
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
