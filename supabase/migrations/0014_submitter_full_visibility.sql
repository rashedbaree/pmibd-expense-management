-- Lets the `submitter` role see expenses across every portfolio, not just
-- their own (submitters have no single portfolio_id and are expected to
-- enter expenses on behalf of any portfolio, then follow them through
-- Finance -> President approval). Consumed by getVisibilityScope()
-- (src/lib/visibility.ts) and, transitively, has_full_expense_visibility()
-- from 0008_full_visibility.sql, which already gates the "read expenses" /
-- "read expense documents" / "read expense approvals" RLS policies.
--
-- Written to be safely re-runnable.

update role_full_visibility set full_visibility = true where role = 'submitter';
