"use client";

import Link from "next/link";

type ReportRow = { label: string; count: number; amount: number };

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const OTHER_REPORTS = [
  {
    href: "/reports/overview",
    label: "Graphical Overview",
    desc: "Monthly spend trend and top portfolios/categories, as charts",
  },
  {
    href: "/reports/budget-vs-actual",
    label: "Budget vs Actual",
    desc: "Approved budget vs actual spend per portfolio and category",
  },
  {
    href: "/reports/unpaid",
    label: "Unpaid Expenses Report",
    desc: "Approved expenses awaiting payment, for Finance/President sign-off",
  },
];

function downloadCsv(filename: string, title: string, rows: ReportRow[]) {
  const lines = [
    [title],
    ["Label", "Count", "Amount"],
    ...rows.map((r) => [r.label, String(r.count), r.amount.toFixed(2)]),
  ];
  const csv = lines
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportSection({ title, rows }: { title: string; rows: ReportRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">{title}</h2>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `${title.toLowerCase().replace(/\s+/g, "-")}.csv`,
              title,
              rows,
            )
          }
          className="print:hidden rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Export CSV (Excel)
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-2">Label</th>
            <th className="px-4 py-2 text-right">Count</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-4 py-2 capitalize">{r.label}</td>
              <td className="px-4 py-2 text-right">{r.count}</td>
              <td className="px-4 py-2 text-right">
                {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-4 text-center text-zinc-500">
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 font-medium dark:border-zinc-800">
            <td className="px-4 py-2">Total</td>
            <td className="px-4 py-2 text-right">
              {rows.reduce((s, r) => s + r.count, 0)}
            </td>
            <td className="px-4 py-2 text-right">
              {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export default function ReportsClient({
  periodWise,
  categoryWise,
  portfolioWise,
  eventWise,
  approvalStatus,
  dateFrom,
  dateTo,
  showAll,
}: {
  periodWise: ReportRow[];
  categoryWise: ReportRow[];
  portfolioWise: ReportRow[];
  eventWise: ReportRow[];
  approvalStatus: ReportRow[];
  dateFrom: string;
  dateTo: string;
  showAll: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Reports
        </h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
        >
          Print / Save as PDF
        </button>
      </div>

      <form className="print:hidden flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          From
          <input type="date" name="date_from" defaultValue={dateFrom} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          To
          <input type="date" name="date_to" defaultValue={dateTo} className={inputClass} />
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
        >
          Filter
        </button>
        <Link href="/reports" className="px-3 py-1.5 text-zinc-500 hover:underline">
          Last 12 months
        </Link>
        <Link href="/reports?all=1" className="px-3 py-1.5 text-zinc-500 hover:underline">
          All time
        </Link>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {showAll ? "All time" : `${dateFrom || "the beginning"} to ${dateTo || "today"}`} ·
        Period/Category/Portfolio/Event tables below count approved + paid
        expenses only (excludes drafts, pending approval, returned, and
        rejected).
      </p>

      <section className="print:hidden">
        <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
          Other Reports
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OTHER_REPORTS.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <p className="font-medium text-zinc-950 dark:text-zinc-50">{r.label}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <ReportSection title="Period-wise" rows={periodWise} />
      <ReportSection title="Category-wise" rows={categoryWise} />
      <ReportSection title="Portfolio-wise" rows={portfolioWise} />
      <ReportSection title="Event-wise" rows={eventWise} />
      <ReportSection title="Approval Status" rows={approvalStatus} />
    </div>
  );
}
