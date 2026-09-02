import type { createClient } from "./supabase/server";
import { signedAmount } from "./expense";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type BudgetCheckResult = {
  overBudget: boolean;
  periodId: string | null;
  periodName: string | null;
  budgeted: number;
  used: number;
  remaining: number;
};

const NO_BUDGET_CHECK: BudgetCheckResult = {
  overBudget: false,
  periodId: null,
  periodName: null,
  budgeted: 0,
  used: 0,
  remaining: 0,
};

// Checks a proposed expense against the budgeted amount for its
// portfolio+category within whichever budget period covers its date -
// the same portfolio/category/period bucketing the Budget vs Actual report
// uses. "Used" is approved/paid ("Actual") plus pending_approval
// ("Committed") expenses already in that bucket, mirroring the report.
// No matching period, or no budget line for this portfolio/category, means
// nothing was approved to spend against - budgeted is treated as 0, so any
// amount is over budget.
export type BudgetSnapshotPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

export type BudgetSnapshotLine = {
  portfolio_id: string;
  category_id: string;
  period_id: string;
  budgeted: number;
  used: number;
};

export type BudgetSnapshot = {
  periods: BudgetSnapshotPeriod[];
  lines: BudgetSnapshotLine[];
};

// Precomputes budgeted vs. used (actual + committed) per portfolio,
// category, and period, for the expense form to warn against client-side as
// the submitter fills it in. Advisory only - checkBudget() re-derives the
// authoritative figure server-side when the expense is actually submitted.
export async function getBudgetSnapshot(supabase: SupabaseClient): Promise<BudgetSnapshot> {
  const [{ data: rawPeriods }, { data: rawBudgets }, { data: rawExpenses }] = await Promise.all([
    supabase.from("budget_periods").select("id, name, start_date, end_date"),
    supabase.from("budgets").select("portfolio_id, category_id, period_id, amount"),
    supabase
      .from("expenses")
      .select("portfolio_id, category_id, date, amount, status, entry_type")
      .in("status", ["approved", "paid", "pending_approval"]),
  ]);

  const periods = (rawPeriods ?? []) as BudgetSnapshotPeriod[];

  const budgetedByKey = new Map<string, number>();
  for (const b of rawBudgets ?? []) {
    if (!b.period_id) continue;
    const k = `${b.portfolio_id}::${b.category_id}::${b.period_id}`;
    budgetedByKey.set(k, (budgetedByKey.get(k) ?? 0) + Number(b.amount));
  }

  const usedByKey = new Map<string, number>();
  for (const e of rawExpenses ?? []) {
    const period = periods.find((p) => p.start_date <= e.date && e.date <= p.end_date);
    if (!period) continue;
    const k = `${e.portfolio_id}::${e.category_id}::${period.id}`;
    usedByKey.set(k, (usedByKey.get(k) ?? 0) + signedAmount(e));
  }

  const keys = new Set([...budgetedByKey.keys(), ...usedByKey.keys()]);
  const lines: BudgetSnapshotLine[] = [...keys].map((k) => {
    const [portfolio_id, category_id, period_id] = k.split("::");
    return {
      portfolio_id,
      category_id,
      period_id,
      budgeted: budgetedByKey.get(k) ?? 0,
      used: usedByKey.get(k) ?? 0,
    };
  });

  return { periods, lines };
}

export async function checkBudget(
  supabase: SupabaseClient,
  params: {
    portfolioId: string;
    categoryId: string;
    date: string;
    amount: number;
  },
): Promise<BudgetCheckResult> {
  const { portfolioId, categoryId, date, amount } = params;

  const { data: period } = await supabase
    .from("budget_periods")
    .select("id, name, start_date, end_date")
    .lte("start_date", date)
    .gte("end_date", date)
    .maybeSingle();

  if (!period) return NO_BUDGET_CHECK;

  const [{ data: budgetRows }, { data: expenseRows }] = await Promise.all([
    supabase
      .from("budgets")
      .select("amount")
      .eq("portfolio_id", portfolioId)
      .eq("category_id", categoryId)
      .eq("period_id", period.id),
    supabase
      .from("expenses")
      .select("amount, status, entry_type")
      .eq("portfolio_id", portfolioId)
      .eq("category_id", categoryId)
      .in("status", ["approved", "paid", "pending_approval"])
      .gte("date", period.start_date)
      .lte("date", period.end_date),
  ]);

  const budgeted = (budgetRows ?? []).reduce((s, b) => s + Number(b.amount), 0);
  const used = (expenseRows ?? []).reduce((s, e) => s + signedAmount(e), 0);
  const remaining = budgeted - used;

  return {
    overBudget: amount > remaining,
    periodId: period.id,
    periodName: period.name,
    budgeted,
    used,
    remaining,
  };
}
