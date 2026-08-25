import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import PrintButton from "./print-button";

type SearchParams = {
  date_from?: string;
  date_to?: string;
};

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function UnpaidReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const profile = await getCurrentProfile();

  const allowed =
    profile?.role === "finance_director" ||
    profile?.role === "president" ||
    profile?.role === "admin";

  if (!allowed) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Unpaid Expenses Report
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Org-wide by design: this is the finance director / president's
  // sign-off audit record, not a portfolio-scoped view, so it isn't
  // filtered by the usual visibility scope.
  let query = supabase
    .from("expenses")
    .select(
      `id, date, amount, description, vendor, payment_method, entry_type,
       portfolio:portfolios(name),
       category:expense_categories(name),
       submitter:users!expenses_submitted_by_fkey(name)`,
    )
    .eq("status", "approved")
    .order("date", { ascending: true });

  if (filters.date_from) query = query.gte("date", filters.date_from);
  if (filters.date_to) query = query.lte("date", filters.date_to);

  const { data: rawExpenses, error } = await query;
  const expenses = rawExpenses as unknown as
    | {
        id: string;
        date: string;
        amount: number;
        description: string;
        vendor: string | null;
        payment_method: string;
        entry_type: "expense" | "reversal";
        portfolio: { name: string } | null;
        category: { name: string } | null;
        submitter: { name: string } | null;
      }[]
    | null;

  const rows = (expenses ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    portfolio: e.portfolio?.name ?? "",
    category: e.category?.name ?? "",
    description: e.description,
    submitter: e.submitter?.name ?? "",
    vendor: e.vendor ?? "",
    paymentMethod: e.payment_method,
    amount: e.entry_type === "reversal" ? -e.amount : e.amount,
  }));

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const generatedAt = new Date().toLocaleString();
  const period =
    filters.date_from || filters.date_to
      ? `${filters.date_from || "the beginning"} to ${filters.date_to || "date"}`
      : "all dates";

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Unpaid Expenses Report
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Approved expenses awaiting payment, for the Finance Director and
            President to review, sign, and keep for audit. Once paid, an
            expense drops off this report — see{" "}
            <Link href="/approvals" className="text-brand hover:underline">
              Approvals
            </Link>{" "}
            to mark expenses as paid.
          </p>
        </div>
        <PrintButton />
      </div>

      <form className="print:hidden flex flex-wrap items-end gap-3 text-sm">
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
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
        >
          Filter
        </button>
        <Link href="/reports/unpaid" className="px-3 py-1.5 text-zinc-500 hover:underline">
          Clear
        </Link>
      </form>

      {error && (
        <p className="print:hidden rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error.message}
        </p>
      )}

      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800 print:border-0 print:p-0">
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            PMI Bangladesh Chapter
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Unpaid Expenses Report
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Period: {period} · Generated: {generatedAt}
          </p>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Portfolio</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2">Submitter</th>
              <th className="px-2 py-2">Vendor</th>
              <th className="px-2 py-2">Payment Method</th>
              <th className="px-2 py-2 text-right">Amount (BDT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1.5 whitespace-nowrap">{r.date}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{r.portfolio}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{r.category}</td>
                <td className="px-2 py-1.5">{r.description}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{r.submitter}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{r.vendor}</td>
                <td className="px-2 py-1.5 whitespace-nowrap capitalize">
                  {r.paymentMethod.replace("_", " ")}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-zinc-500">
                  No unpaid expenses for this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-400 font-medium dark:border-zinc-600">
              <td colSpan={7} className="px-2 py-2 text-right">
                Total
              </td>
              <td className="px-2 py-2 text-right">
                {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-16 grid grid-cols-2 gap-12 text-sm">
          <div>
            <div className="border-t border-zinc-400 pt-2 dark:border-zinc-600">
              Finance Director — Signature &amp; Date
            </div>
          </div>
          <div>
            <div className="border-t border-zinc-400 pt-2 dark:border-zinc-600">
              President — Signature &amp; Date
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
