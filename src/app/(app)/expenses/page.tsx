import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getVisibilityScope } from "@/lib/visibility";
import { StatusBadge } from "@/components/StatusBadge";
import type { ExpenseStatus } from "@/lib/types";

const STATUS_OPTIONS: ExpenseStatus[] = [
  "draft",
  "submitted",
  "pending_approval",
  "returned",
  "rejected",
  "approved",
  "paid",
];

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type SearchParams = {
  status?: string;
  portfolio_id?: string;
  category_id?: string;
  submitted_by?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: string;
  amount_max?: string;
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const scope = await getVisibilityScope(supabase, profile);

  const [{ data: allPortfolios }, { data: categories }, { data: users }] =
    await Promise.all([
      supabase.from("portfolios").select("id, name").order("name"),
      supabase.from("expense_categories").select("id, name").order("name"),
      supabase.from("users").select("id, name").order("name"),
    ]);

  const portfolios = scope.fullVisibility
    ? (allPortfolios ?? [])
    : (allPortfolios ?? []).filter((p) => p.id === profile.portfolio_id);

  let query = supabase
    .from("expenses")
    .select(
      `id, date, amount, status, description, vendor, cheque_number, entry_type, reverses_expense_id,
       portfolio:portfolios(name),
       category:expense_categories(name),
       submitter:users!expenses_submitted_by_fkey(name)`,
    )
    .order("date", { ascending: false });

  if (!scope.fullVisibility) {
    query = query.eq("portfolio_id", scope.portfolioId ?? "__none__");
  }

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.portfolio_id) query = query.eq("portfolio_id", filters.portfolio_id);
  if (filters.category_id) query = query.eq("category_id", filters.category_id);
  if (filters.submitted_by) query = query.eq("submitted_by", filters.submitted_by);
  if (filters.date_from) query = query.gte("date", filters.date_from);
  if (filters.date_to) query = query.lte("date", filters.date_to);
  if (filters.amount_min) query = query.gte("amount", Number(filters.amount_min));
  if (filters.amount_max) query = query.lte("amount", Number(filters.amount_max));

  const { data: rawExpenses, error } = await query;
  const expenses = rawExpenses as unknown as
    | {
        id: string;
        date: string;
        amount: number;
        status: ExpenseStatus;
        description: string;
        vendor: string | null;
        cheque_number: string | null;
        entry_type: "expense" | "reversal";
        reverses_expense_id: string | null;
        portfolio: { name: string } | null;
        category: { name: string } | null;
        submitter: { name: string } | null;
      }[]
    | null;

  const reversedIds = new Set(
    (expenses ?? [])
      .map((e) => e.reverses_expense_id)
      .filter((id): id is string => Boolean(id)),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Expenses
        </h1>
        <Link
          href="/expenses/new"
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
        >
          New Expense
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={filters.status ?? ""} className={inputClass}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Portfolio
          <select
            name="portfolio_id"
            defaultValue={filters.portfolio_id ?? ""}
            className={inputClass}
          >
            <option value="">All</option>
            {(portfolios ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Category
          <select
            name="category_id"
            defaultValue={filters.category_id ?? ""}
            className={inputClass}
          >
            <option value="">All</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Submitter
          <select
            name="submitted_by"
            defaultValue={filters.submitted_by ?? ""}
            className={inputClass}
          >
            <option value="">All</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          From
          <input
            type="date"
            name="date_from"
            defaultValue={filters.date_from ?? ""}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          To
          <input
            type="date"
            name="date_to"
            defaultValue={filters.date_to ?? ""}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          Min amount
          <input
            type="number"
            name="amount_min"
            defaultValue={filters.amount_min ?? ""}
            className={`${inputClass} w-28`}
          />
        </label>

        <label className="flex flex-col gap-1">
          Max amount
          <input
            type="number"
            name="amount_max"
            defaultValue={filters.amount_max ?? ""}
            className={`${inputClass} w-28`}
          />
        </label>

        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
        >
          Filter
        </button>
        <Link href="/expenses" className="px-3 py-1.5 text-zinc-500 hover:underline">
          Clear
        </Link>
      </form>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error.message}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Portfolio</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Submitter</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Cheque #</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {(expenses ?? []).map((e) => {
              const isReversal = e.entry_type === "reversal";
              const canReverse =
                !isReversal &&
                (e.status === "approved" || e.status === "paid") &&
                !reversedIds.has(e.id);
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{e.date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.portfolio?.name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.category?.name}
                  </td>
                  <td
                    className="max-w-xs truncate px-3 py-2"
                    title={e.description}
                  >
                    {isReversal && (
                      <span className="mr-1.5 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Reversal
                      </span>
                    )}
                    {e.description}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.submitter?.name}
                  </td>
                  <td
                    className={`px-3 py-2 text-right whitespace-nowrap ${
                      isReversal ? "text-red-600 dark:text-red-400" : ""
                    }`}
                  >
                    {isReversal ? "−" : ""}
                    {Number(e.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.cheque_number ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {canReverse && (
                      <Link
                        href={`/expenses/${e.id}/reverse`}
                        className="text-sm text-brand hover:underline"
                      >
                        Reverse
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {(expenses ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-zinc-500">
                  No expenses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
