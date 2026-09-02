import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getVisibilityScope } from "@/lib/visibility";
import { signedAmount } from "@/lib/expense";
import type { EntryType, ExpenseStatus } from "@/lib/types";
import ReportsClient from "./client";

type Row = {
  id: string;
  date: string;
  amount: number;
  status: ExpenseStatus;
  entry_type: EntryType;
  portfolio: { name: string } | null;
  category: { name: string } | null;
  event: { name: string } | null;
};

type SearchParams = { date_from?: string; date_to?: string; all?: string };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const scope = await getVisibilityScope(supabase, profile);

  // Default to the last 12 months so the charts stay readable - "All time"
  // (or an explicit date range) opts out of that default.
  const showAll = filters.all === "1";
  const today = new Date();
  const defaultFromDate = new Date(today);
  defaultFromDate.setMonth(defaultFromDate.getMonth() - 11, 1);
  const defaultFrom = isoDate(defaultFromDate);
  const defaultTo = isoDate(today);

  const dateFrom = showAll ? (filters.date_from ?? "") : (filters.date_from || defaultFrom);
  const dateTo = showAll ? (filters.date_to ?? "") : (filters.date_to || defaultTo);

  let query = supabase
    .from("expenses")
    .select(
      `id, date, amount, status, entry_type,
       portfolio:portfolios(name),
       category:expense_categories(name),
       event:events(name)`,
    )
    .order("date", { ascending: false });
  if (!scope.fullVisibility) {
    query = query.eq("portfolio_id", scope.portfolioId ?? "__none__");
  }
  if (dateFrom) query = query.gte("date", dateFrom);
  if (dateTo) query = query.lte("date", dateTo);

  const { data: raw } = await query;

  const expenses = (raw ?? []) as unknown as Row[];

  // Approved + paid only - draft/pending/returned/rejected expenses were
  // never actually spent, so counting them here would overstate spend.
  // Approval Status below is the one place every status belongs, since its
  // whole point is showing the distribution across them.
  const spendExpenses = expenses.filter(
    (e) => e.status === "approved" || e.status === "paid",
  );

  const sumBy = (rows: Row[], key: (e: Row) => string) => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const e of rows) {
      const k = key(e);
      const entry = map.get(k) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += signedAmount(e);
      map.set(k, entry);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.amount - a.amount);
  };

  const periodWise = sumBy(spendExpenses, (e) => e.date.slice(0, 7)).sort((a, b) =>
    b.label.localeCompare(a.label),
  );
  const categoryWise = sumBy(spendExpenses, (e) => e.category?.name ?? "Uncategorized");
  const portfolioWise = sumBy(spendExpenses, (e) => e.portfolio?.name ?? "Unassigned");
  const eventWise = sumBy(spendExpenses, (e) => e.event?.name ?? "No event");
  const approvalStatus = sumBy(expenses, (e) => e.status);

  return (
    <ReportsClient
      periodWise={periodWise}
      categoryWise={categoryWise}
      portfolioWise={portfolioWise}
      eventWise={eventWise}
      approvalStatus={approvalStatus}
      dateFrom={dateFrom}
      dateTo={dateTo}
      showAll={showAll}
    />
  );
}
