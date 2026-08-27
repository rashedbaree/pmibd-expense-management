import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import ExpenseImportForm from "../reconciliation/expense-import-form";
import {
  addBudgetPeriod,
  deleteBudget,
  deleteBudgetPeriod,
  importBudgets,
} from "./actions";

const SAMPLE_CSV = `period,portfolio,category,initiative,planned_date,amount,remarks
FY2026,Membership,Venue & Logistics,Non Renewed Members Meet,May,10000,
FY2026,Technology,IT & Communication,Technology & Digital Enablement,20-Apr-26,55000,Microsoft Email (M365)`;

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type PeriodRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

type BudgetRow = {
  id: string;
  initiative_name: string | null;
  planned_date: string | null;
  amount: number;
  remarks: string | null;
  portfolio: { name: string } | null;
  category: { name: string } | null;
  period: { name: string } | null;
};

export default async function AdminBudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    created?: string;
    errors?: string;
    moreErrors?: string;
  }>;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;

  if (!profile || profile.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Budgets
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: rawPeriods }, { data: rawRows }] = await Promise.all([
    supabase
      .from("budget_periods")
      .select("id, name, start_date, end_date")
      .order("start_date", { ascending: false }),
    supabase
      .from("budgets")
      .select(
        `id, initiative_name, planned_date, amount, remarks,
         portfolio:portfolios(name),
         category:expense_categories(name),
         period:budget_periods(name)`,
      )
      .order("created_at", { ascending: false }),
  ]);

  const periods = (rawPeriods ?? []) as PeriodRow[];
  const rows = (rawRows ?? []) as unknown as BudgetRow[];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const rowErrors = params.errors ? params.errors.split("|") : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Budgets
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          The approved budget per portfolio and category, used by Reports →
          Budget vs Actual to flag overspending. Portfolio and category
          values must match the names already set up in Admin.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
          Budget Periods
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every budget line belongs to a period (e.g. a fiscal year), so next
          year&apos;s budget can be imported without blending into this
          year&apos;s numbers, and Budget vs Actual only counts expenses
          dated within the selected period.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {periods.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
            >
              <span className="min-w-32 font-medium text-zinc-950 dark:text-zinc-50">
                {p.name}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {p.start_date} → {p.end_date}
              </span>
              <form action={deleteBudgetPeriod} className="ml-auto">
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="text-sm text-red-700 hover:underline dark:text-red-400"
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
          {periods.length === 0 && (
            <p className="text-sm text-zinc-500">No budget periods yet — add one below.</p>
          )}
        </div>

        <form action={addBudgetPeriod} className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Name
            <input
              name="name"
              type="text"
              placeholder="FY2026"
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            Start date
            <input name="start_date" type="date" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            End date
            <input name="end_date" type="date" required className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand/90"
          >
            Add period
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
          Import Budget
        </h2>
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <strong className="text-zinc-950 dark:text-zinc-50">Required:</strong>{" "}
            period, portfolio, category, amount
            <br />
            <strong className="text-zinc-950 dark:text-zinc-50">Optional:</strong>{" "}
            initiative, planned_date, remarks
          </p>
          <p className="mt-2">
            <code>period</code> must match a period name added above.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {SAMPLE_CSV}
          </pre>
        </div>

        {params.error && (
          <p className="mt-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {params.error}
          </p>
        )}
        {params.created !== undefined && rowErrors.length === 0 && (
          <div className="mt-4 max-w-3xl rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Imported {params.created} budget line
            {params.created === "1" ? "" : "s"}.
          </div>
        )}
        {rowErrors.length > 0 && (
          <div className="mt-3 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            <p className="font-medium">
              Nothing was imported — fix {rowErrors.length} row
              {rowErrors.length === 1 ? "" : "s"} below and re-upload:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {rowErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {params.moreErrors && (
              <p className="mt-1">…and {params.moreErrors} more.</p>
            )}
          </div>
        )}

        <ExpenseImportForm action={importBudgets} />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
            Current budget lines
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Total:{" "}
            {total.toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT
          </p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Portfolio</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Initiative</th>
                <th className="px-3 py-2">Planned</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Remarks</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{r.period?.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.portfolio?.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.category?.name}</td>
                  <td className="px-3 py-2">{r.initiative_name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.planned_date}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {Number(r.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2">{r.remarks}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <form action={deleteBudget}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-700 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                    No budget lines imported yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
