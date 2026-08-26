import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import ExpenseImportForm from "../reconciliation/expense-import-form";
import { deleteBudget, importBudgets } from "./actions";

const SAMPLE_CSV = `portfolio,category,initiative,planned_date,amount,remarks
Membership,Venue & Logistics,Non Renewed Members Meet,May,10000,
Technology,IT & Communication,Technology & Digital Enablement,20-Apr-26,55000,Microsoft Email (M365)`;

type BudgetRow = {
  id: string;
  initiative_name: string | null;
  planned_date: string | null;
  amount: number;
  remarks: string | null;
  portfolio: { name: string } | null;
  category: { name: string } | null;
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
  const { data: rawRows } = await supabase
    .from("budgets")
    .select(
      `id, initiative_name, planned_date, amount, remarks,
       portfolio:portfolios(name),
       category:expense_categories(name)`,
    )
    .order("created_at", { ascending: false });

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
          Import Budget
        </h2>
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <strong className="text-zinc-950 dark:text-zinc-50">Required:</strong>{" "}
            portfolio, category, amount
            <br />
            <strong className="text-zinc-950 dark:text-zinc-50">Optional:</strong>{" "}
            initiative, planned_date, remarks
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
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
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
