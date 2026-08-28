-- Budget validation on expense submission
-- Flags an expense that pushes its portfolio+category over the budgeted
-- amount for the period covering its date (same bucketing as the Budget vs
-- Actual report). Over-budget expenses are still allowed to submit, but the
-- app forces finance_director into their approval chain if the
-- admin-configured chain doesn't already include that role, so a budget
-- overage always needs Finance Director sign-off. Run after
-- 0012_budget_periods.sql.

alter table expenses add column if not exists over_budget boolean not null default false;
