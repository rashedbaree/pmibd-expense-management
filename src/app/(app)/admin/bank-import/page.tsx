import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccessDenied } from "@/components/AccessDenied";
import BankImportForm from "./BankImportForm";

type Row = {
  id: string;
  trans_date: string;
  cheque_number: string | null;
  ref: string | null;
  narration: string | null;
  trans_details: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
};

function formatAmount(n: number | null) {
  if (n === null) return "";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export default async function BankImportPage({
  searchParams,
}: {
  searchParams: Promise<{ date_from?: string; date_to?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Bank Statement
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const filters = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("bank_transactions")
    .select("id, trans_date, cheque_number, ref, narration, trans_details, debit, credit, balance")
    .order("trans_date", { ascending: false })
    .limit(300);

  if (filters.date_from) query = query.gte("trans_date", filters.date_from);
  if (filters.date_to) query = query.lte("trans_date", filters.date_to);

  const { data: rawTransactions, error } = await query;
  const transactions = (rawTransactions ?? []) as unknown as Row[];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Bank Statement
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Upload bank statement lines for record-keeping. Re-uploading a
        statement (or an overlapping date range) is safe — duplicate rows are
        skipped automatically.
      </p>

      <div className="mt-4 max-w-2xl rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="font-medium text-zinc-950 dark:text-zinc-50">
          Columns (header row required) — upload the .xlsx directly, or a .csv
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Required: <code>Trans. Date</code>, <code>Balance</code>, and at
          least one of <code>Debit</code> / <code>Credit</code> per row
          <br />
          Optional: <code>Cheque#</code>, <code>Ref.</code>,{" "}
          <code>Narration</code>, <code>Trans. Details</code>
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Dates: <code>YYYY-MM-DD</code>, <code>1-Jul-25</code>, or{" "}
          <code>DD/MM/YYYY</code>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
{`Trans. Date,Cheque#,Ref.,Narration,Trans. Details,Debit,Credit,Balance
1-Jul-25,1579288,REF001,Cheque paid,Office supplies,1500,,248500.00`}
        </pre>
      </div>

      <BankImportForm />

      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
          Uploaded Transactions
        </h2>

        <form className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            From
            <input
              type="date"
              name="date_from"
              defaultValue={filters.date_from ?? ""}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            To
            <input
              type="date"
              name="date_to"
              defaultValue={filters.date_to ?? ""}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
          >
            Filter
          </button>
          <a href="/admin/bank-import" className="px-3 py-1.5 text-zinc-500 hover:underline">
            Clear
          </a>
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
                <th className="px-3 py-2">Cheque #</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Narration</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{t.trans_date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{t.cheque_number ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{t.ref ?? "—"}</td>
                  <td className="max-w-xs truncate px-3 py-2" title={t.narration ?? ""}>
                    {t.narration}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatAmount(t.debit)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatAmount(t.credit)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatAmount(t.balance)}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                    No bank transactions uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
