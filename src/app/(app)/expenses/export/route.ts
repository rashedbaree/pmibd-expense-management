import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getVisibilityScope } from "@/lib/visibility";
import type { ExpenseStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const scope = await getVisibilityScope(supabase, profile);
  const filters = request.nextUrl.searchParams;

  let query = supabase
    .from("expenses")
    .select(
      `date, amount, status, description, vendor, cheque_number, entry_type, remarks, payment_method,
       portfolio:portfolios(name),
       category:expense_categories(name),
       submitter:users!expenses_submitted_by_fkey(name)`,
    )
    .order("date", { ascending: false });

  if (!scope.fullVisibility) {
    query = query.eq("portfolio_id", scope.portfolioId ?? "__none__");
  }

  const status = filters.get("status");
  const portfolioId = filters.get("portfolio_id");
  const categoryId = filters.get("category_id");
  const submittedBy = filters.get("submitted_by");
  const dateFrom = filters.get("date_from");
  const dateTo = filters.get("date_to");
  const amountMin = filters.get("amount_min");
  const amountMax = filters.get("amount_max");

  if (status) query = query.eq("status", status as ExpenseStatus);
  if (portfolioId) query = query.eq("portfolio_id", portfolioId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (submittedBy) query = query.eq("submitted_by", submittedBy);
  if (dateFrom) query = query.gte("date", dateFrom);
  if (dateTo) query = query.lte("date", dateTo);
  if (amountMin) query = query.gte("amount", Number(amountMin));
  if (amountMax) query = query.lte("amount", Number(amountMax));

  const { data: rawExpenses, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const expenses = rawExpenses as unknown as
    | {
        date: string;
        amount: number;
        status: ExpenseStatus;
        description: string;
        vendor: string | null;
        cheque_number: string | null;
        entry_type: "expense" | "reversal";
        remarks: string | null;
        payment_method: string;
        portfolio: { name: string } | null;
        category: { name: string } | null;
        submitter: { name: string } | null;
      }[]
    | null;

  const rows = (expenses ?? []).map((e) => ({
    Date: e.date,
    Portfolio: e.portfolio?.name ?? "",
    Category: e.category?.name ?? "",
    Description: e.description,
    Submitter: e.submitter?.name ?? "",
    Vendor: e.vendor ?? "",
    "Payment Method": e.payment_method,
    Amount: e.entry_type === "reversal" ? -e.amount : e.amount,
    "Cheque #": e.cheque_number ?? "",
    Status: e.status,
    Type: e.entry_type,
    Remarks: e.remarks ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const filename = `expenses-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
