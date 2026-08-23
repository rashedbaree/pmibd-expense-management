import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { resubmitExpense } from "../../actions";
import EditExpenseForm from "./form";

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [{ data: expense }, { data: portfolios }, { data: events }, { data: categories }, { data: vendorRows }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select(
          "id, date, portfolio_id, event_id, category_id, description, vendor, payment_method, amount, remarks, status, submitted_by",
        )
        .eq("id", id)
        .single(),
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

  const eligible =
    expense && expense.status === "returned" && expense.submitted_by === profile.id;

  const { data: rawReturnComment } = eligible
    ? await supabase
        .from("expense_approvals")
        .select("comment")
        .eq("expense_id", id)
        .eq("action", "return")
        .order("acted_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Edit &amp; Resubmit Expense
      </h1>

      {error && (
        <p className="mt-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {!eligible ? (
        <p className="mt-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {!expense
            ? "Expense not found."
            : expense.submitted_by !== profile.id
              ? "You can only edit your own expenses."
              : "Only a returned expense can be edited and resubmitted."}
        </p>
      ) : (
        <>
          {rawReturnComment?.comment && (
            <p className="mt-4 max-w-2xl rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <strong>Reason for return:</strong> {rawReturnComment.comment}
            </p>
          )}

          <EditExpenseForm
            action={resubmitExpense}
            expenseId={expense.id}
            portfolios={portfolios ?? []}
            events={events ?? []}
            categories={categories ?? []}
            vendors={vendors}
            defaults={{
              date: expense.date,
              portfolio_id: expense.portfolio_id,
              event_id: expense.event_id,
              category_id: expense.category_id,
              description: expense.description,
              vendor: expense.vendor,
              payment_method: expense.payment_method,
              amount: expense.amount,
              remarks: expense.remarks,
            }}
          />
        </>
      )}
    </div>
  );
}
