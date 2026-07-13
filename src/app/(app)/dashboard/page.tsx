import { createClient } from "@/lib/supabase/server";
import type { ExpenseStatus } from "@/lib/types";

type Row = {
  id: string;
  date: string;
  amount: number;
  status: ExpenseStatus;
  portfolio: { name: string } | null;
  category: { name: string } | null;
};

function formatAmount(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("expenses")
    .select(
      `id, date, amount, status,
       portfolio:portfolios(name),
       category:expense_categories(name)`,
    );

  const expenses = (raw ?? []) as unknown as Row[];

  const totalCount = expenses.length;
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const pending = expenses.filter((e) => e.status === "pending_approval");
  const approved = expenses.filter(
    (e) => e.status === "approved" || e.status === "paid",
  );
  const rejected = expenses.filter((e) => e.status === "rejected");

  const monthly = new Map<string, number>();
  const byPortfolio = new Map<string, number>();
  const byCategory = new Map<string, number>();

  for (const e of expenses) {
    const month = e.date.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + Number(e.amount));

    const portfolioName = e.portfolio?.name ?? "Unassigned";
    byPortfolio.set(
      portfolioName,
      (byPortfolio.get(portfolioName) ?? 0) + Number(e.amount),
    );

    const categoryName = e.category?.name ?? "Uncategorized";
    byCategory.set(
      categoryName,
      (byCategory.get(categoryName) ?? 0) + Number(e.amount),
    );
  }

  const monthlyRows = [...monthly.entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  );
  const portfolioRows = [...byPortfolio.entries()].sort((a, b) => b[1] - a[1]);
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const tiles = [
    { label: "Total Expenses", value: totalCount, sub: `${formatAmount(totalAmount)} BDT` },
    { label: "Pending Approval", value: pending.length, sub: `${formatAmount(pending.reduce((s, e) => s + Number(e.amount), 0))} BDT` },
    { label: "Approved / Paid", value: approved.length, sub: `${formatAmount(approved.reduce((s, e) => s + Number(e.amount), 0))} BDT` },
    { label: "Rejected", value: rejected.length, sub: `${formatAmount(rejected.reduce((s, e) => s + Number(e.amount), 0))} BDT` },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {t.value}
            </p>
            <p className="text-sm text-zinc-500">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SummaryTable title="Monthly Summary" rows={monthlyRows} />
        <SummaryTable title="Portfolio-wise" rows={portfolioRows} />
        <SummaryTable title="Category-wise" rows={categoryRows} />
      </div>
    </div>
  );
}

function SummaryTable({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <h2 className="border-b border-zinc-200 px-4 py-2 font-medium text-zinc-950 dark:border-zinc-800 dark:text-zinc-50">
        {title}
      </h2>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map(([label, amount]) => (
            <tr key={label}>
              <td className="px-4 py-2">{label}</td>
              <td className="px-4 py-2 text-right">{formatAmount(amount)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-4 text-center text-zinc-500">
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
