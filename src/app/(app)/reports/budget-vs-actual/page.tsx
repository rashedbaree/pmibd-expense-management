import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { PrintButton } from "@/components/PrintButton";
import { signedAmount } from "@/lib/expense";
import type { EntryType, ExpenseStatus } from "@/lib/types";

type BudgetRow = {
  amount: number;
  portfolio: { name: string } | null;
  category: { name: string } | null;
};

type ExpenseRow = {
  amount: number;
  status: ExpenseStatus;
  entry_type: EntryType;
  portfolio: { name: string } | null;
  category: { name: string } | null;
};

export default async function BudgetVsActualPage() {
  const profile = await getCurrentProfile();

  const allowed =
    profile?.role === "finance_director" ||
    profile?.role === "president" ||
    profile?.role === "admin";

  if (!allowed) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Budget vs Actual
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Org-wide, like the Unpaid Expenses Report - this is a finance
  // oversight tool, not filtered by the usual portfolio visibility scope.
  const [{ data: rawBudgets }, { data: rawExpenses }] = await Promise.all([
    supabase
      .from("budgets")
      .select(`amount, portfolio:portfolios(name), category:expense_categories(name)`),
    supabase
      .from("expenses")
      .select(
        `amount, status, entry_type, portfolio:portfolios(name), category:expense_categories(name)`,
      )
      .in("status", ["approved", "paid"]),
  ]);

  const budgets = (rawBudgets ?? []) as unknown as BudgetRow[];
  const expenses = (rawExpenses ?? []) as unknown as ExpenseRow[];

  const key = (portfolio: string, category: string) => `${portfolio} :: ${category}`;

  const budgetedByKey = new Map<string, number>();
  for (const b of budgets) {
    const k = key(b.portfolio?.name ?? "Unassigned", b.category?.name ?? "Uncategorized");
    budgetedByKey.set(k, (budgetedByKey.get(k) ?? 0) + Number(b.amount));
  }

  const actualByKey = new Map<string, number>();
  for (const e of expenses) {
    const k = key(e.portfolio?.name ?? "Unassigned", e.category?.name ?? "Uncategorized");
    actualByKey.set(k, (actualByKey.get(k) ?? 0) + signedAmount(e));
  }

  const allKeys = new Set([...budgetedByKey.keys(), ...actualByKey.keys()]);
  const rows = [...allKeys]
    .map((k) => {
      const [portfolio, category] = k.split(" :: ");
      const budgeted = budgetedByKey.get(k) ?? 0;
      const actual = actualByKey.get(k) ?? 0;
      return { portfolio, category, budgeted, actual, remaining: budgeted - actual };
    })
    .sort((a, b) => a.remaining - b.remaining);

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Budget vs Actual
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Approved budget per portfolio and category against approved +
            paid expenses so far. Rows in red have spent more than budgeted.
            Manage the budget figures in{" "}
            <Link href="/admin/budgets" className="text-brand hover:underline">
              Admin → Budgets
            </Link>
            .
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Portfolio</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Budgeted</th>
              <th className="px-3 py-2 text-right">Actual</th>
              <th className="px-3 py-2 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <tr
                key={`${r.portfolio}::${r.category}`}
                className={r.remaining < 0 ? "bg-red-50 dark:bg-red-950/40" : ""}
              >
                <td className="px-3 py-2 whitespace-nowrap">{r.portfolio}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.category}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {r.budgeted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {r.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td
                  className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                    r.remaining < 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-zinc-950 dark:text-zinc-50"
                  }`}
                >
                  {r.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  No budget or expense data yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-400 font-medium dark:border-zinc-600">
              <td colSpan={2} className="px-3 py-2">
                Total
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {totalBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {totalActual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {(totalBudgeted - totalActual).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
