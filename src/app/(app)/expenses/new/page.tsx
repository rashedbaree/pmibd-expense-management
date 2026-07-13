import { createClient } from "@/lib/supabase/server";
import { createExpense } from "../actions";
import NewExpenseForm from "./form";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: portfolios }, { data: events }, { data: categories }, { data: vendorRows }] =
    await Promise.all([
      supabase.from("portfolios").select("id, name").order("name"),
      supabase
        .from("events")
        .select("id, name, date, portfolio_id")
        .order("date", { ascending: false }),
      supabase
        .from("expense_categories")
        .select("id, name, parent_category_id")
        .order("name"),
      supabase.from("expenses").select("vendor").not("vendor", "is", null),
    ]);

  const vendors = [
    ...new Set(
      (vendorRows ?? [])
        .map((v) => v.vendor as string)
        .filter((v): v is string => Boolean(v)),
    ),
  ].sort();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Submit Expense
      </h1>

      {error && (
        <p className="mt-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <NewExpenseForm
        action={createExpense}
        portfolios={portfolios ?? []}
        events={events ?? []}
        categories={categories ?? []}
        vendors={vendors}
      />
    </div>
  );
}
