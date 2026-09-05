"use client";

import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { RankedBarChart, TrendColumnChart } from "@/components/charts/BarCharts";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMonthLabel(label: string) {
  const [year, month] = label.split("-");
  const idx = Number(month) - 1;
  return MONTH_NAMES[idx] ? `${MONTH_NAMES[idx]} '${year.slice(2)}` : label;
}

function formatChartAmount(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type ReportRow = { label: string; count: number; amount: number };

export default function OverviewClient({
  periodWise,
  categoryWise,
  portfolioWise,
  dateFrom,
  dateTo,
  showAll,
}: {
  periodWise: ReportRow[];
  categoryWise: ReportRow[];
  portfolioWise: ReportRow[];
  dateFrom: string;
  dateTo: string;
  showAll: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Graphical Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Monthly trend and top portfolios/categories by spend. See{" "}
            <Link href="/reports" className="text-brand hover:underline">
              Reports
            </Link>{" "}
            for the full data tables.
          </p>
        </div>
        <PrintButton />
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
        <Link href="/reports/overview" className="px-3 py-1.5 text-zinc-500 hover:underline">
          Last 12 months
        </Link>
        <Link href="/reports/overview?all=1" className="px-3 py-1.5 text-zinc-500 hover:underline">
          All time
        </Link>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {showAll ? "All time" : `${dateFrom || "the beginning"} to ${dateTo || "today"}`} ·
        approved + paid expenses only (excludes drafts, pending approval,
        returned, and rejected).
      </p>

      <div className="grid grid-cols-1 gap-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 lg:grid-cols-3">
        <TrendColumnChart
          title="Monthly Spend Trend"
          data={[...periodWise]
            .sort((a, b) => a.label.localeCompare(b.label))
            .slice(-24)
            .map((r) => ({ label: r.label, value: r.amount }))}
          colorVar="--chart-series-1"
          formatValue={formatChartAmount}
          formatLabel={formatMonthLabel}
        />
        <RankedBarChart
          title="Top Portfolios by Spend"
          data={portfolioWise.map((r) => ({ label: r.label, value: r.amount }))}
          colorVar="--chart-series-2"
          formatValue={formatChartAmount}
        />
        <RankedBarChart
          title="Top Categories by Spend"
          data={categoryWise.map((r) => ({ label: r.label, value: r.amount }))}
          colorVar="--chart-series-3"
          formatValue={formatChartAmount}
        />
      </div>
    </div>
  );
}
