"use client";

import { useMemo } from "react";
import type { BudgetSnapshot } from "@/lib/budget";

export type BudgetWarning = {
  periodName: string;
  budgeted: number;
  used: number;
  remaining: number;
};

// Client-side mirror of checkBudget() in src/lib/budget.ts, used to warn a
// submitter as they fill in the form. Advisory only - the server re-checks
// authoritatively (and forces Finance Director approval) when the expense
// is actually submitted, so this never needs to block the form.
export function useBudgetWarning(
  snapshot: BudgetSnapshot,
  portfolioId: string,
  categoryId: string,
  date: string,
  amount: number,
): BudgetWarning | null {
  return useMemo(() => {
    if (!portfolioId || !categoryId || !date || !amount) return null;
    const period = snapshot.periods.find(
      (p) => p.start_date <= date && date <= p.end_date,
    );
    if (!period) return null;
    const line = snapshot.lines.find(
      (l) =>
        l.portfolio_id === portfolioId &&
        l.category_id === categoryId &&
        l.period_id === period.id,
    );
    const budgeted = line?.budgeted ?? 0;
    const used = line?.used ?? 0;
    const remaining = budgeted - used;
    if (amount <= remaining) return null;
    return { periodName: period.name, budgeted, used, remaining };
  }, [snapshot, portfolioId, categoryId, date, amount]);
}

export function BudgetWarningModal({
  warning,
  onCancel,
  onConfirm,
}: {
  warning: BudgetWarning;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
          ⚠ Over Budget
        </h2>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          This expense exceeds the approved budget for this portfolio/category in{" "}
          {warning.periodName}.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <dt>Budgeted</dt>
          <dd className="text-right">{fmt(warning.budgeted)}</dd>
          <dt>Already used</dt>
          <dd className="text-right">{fmt(warning.used)}</dd>
          <dt>Remaining</dt>
          <dd className="text-right font-medium text-red-700 dark:text-red-400">
            {fmt(warning.remaining)}
          </dd>
        </dl>
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          You can still submit, but this will be flagged as over budget and routed to the
          Finance Director for approval.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Submit Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export function BudgetWarningBanner({ warning }: { warning: BudgetWarning | null }) {
  if (!warning) return null;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
      <p className="font-medium">
        ⚠ This exceeds the approved budget for this portfolio/category in{" "}
        {warning.periodName}.
      </p>
      <p>
        Budgeted: {fmt(warning.budgeted)} · Already used: {fmt(warning.used)} · Remaining:{" "}
        {fmt(warning.remaining)}
      </p>
      <p className="mt-1">
        You can still submit — this will be flagged as over budget and routed to the
        Finance Director for approval.
      </p>
    </div>
  );
}
