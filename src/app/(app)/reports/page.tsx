import { createClient } from "@/lib/supabase/server";
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

function signedAmount(e: Row) {
  return e.entry_type === "reversal" ? -Number(e.amount) : Number(e.amount);
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("expenses")
    .select(
      `id, date, amount, status, entry_type,
       portfolio:portfolios(name),
       category:expense_categories(name),
       event:events(name)`,
    )
    .order("date", { ascending: false });

  const expenses = (raw ?? []) as unknown as Row[];

  const sumBy = (key: (e: Row) => string) => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const e of expenses) {
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

  const periodWise = sumBy((e) => e.date.slice(0, 7)).sort((a, b) =>
    b.label.localeCompare(a.label),
  );
  const categoryWise = sumBy((e) => e.category?.name ?? "Uncategorized");
  const portfolioWise = sumBy((e) => e.portfolio?.name ?? "Unassigned");
  const eventWise = sumBy((e) => e.event?.name ?? "No event");
  const approvalStatus = sumBy((e) => e.status);

  return (
    <ReportsClient
      periodWise={periodWise}
      categoryWise={categoryWise}
      portfolioWise={portfolioWise}
      eventWise={eventWise}
      approvalStatus={approvalStatus}
    />
  );
}
