import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createReversal } from "../../actions";
import { REMARKS_MAX_LENGTH } from "@/lib/constants";

export default async function ReverseExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select(
      `id, date, amount, description, vendor, status, entry_type,
       portfolio:portfolios(name),
       category:expense_categories(name)`,
    )
    .eq("id", id)
    .single();

  const original = expense as unknown as {
    id: string;
    date: string;
    amount: number;
    description: string;
    vendor: string | null;
    status: string;
    entry_type: string;
    portfolio: { name: string } | null;
    category: { name: string } | null;
  } | null;

  const { data: existingReversal } = await supabase
    .from("expenses")
    .select("id")
    .eq("reverses_expense_id", id)
    .maybeSingle();

  const eligible =
    original &&
    original.entry_type === "expense" &&
    (original.status === "approved" || original.status === "paid") &&
    !existingReversal;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Reverse Expense
      </h1>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {!eligible ? (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {!original
            ? "Expense not found."
            : existingReversal
              ? "This expense has already been reversed."
              : "Only approved or paid expenses can be reversed."}
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <p className="font-medium text-zinc-950 dark:text-zinc-50">
              {original.description}
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {original.date} · {original.portfolio?.name} ·{" "}
              {original.category?.name}
              {original.vendor ? ` · ${original.vendor}` : ""}
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {Number(original.amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}{" "}
              BDT
            </p>
          </div>

          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            This creates an offsetting entry for the full amount above and
            sends it through approval, the same as a new expense. Once
            approved, it nets out against the original in reports.
          </p>

          <form action={createReversal} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="expense_id" value={original.id} />
            <label className="flex flex-col gap-1 text-sm">
              Reason for reversal
              <textarea
                name="remarks"
                required
                rows={3}
                maxLength={REMARKS_MAX_LENGTH}
                placeholder="e.g. Cheque bounced, event was cancelled"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                Submit Reversal
              </button>
              <Link
                href="/expenses"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Cancel
              </Link>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
