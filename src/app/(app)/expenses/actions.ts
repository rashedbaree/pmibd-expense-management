"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APPROVAL_CHAIN } from "@/lib/approval";
import type { UserRole } from "@/lib/types";

export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const date = formData.get("date") as string;
  const portfolio_id = formData.get("portfolio_id") as string;
  const event_id = (formData.get("event_id") as string) || null;
  const category_id = formData.get("category_id") as string;
  const description = formData.get("description") as string;
  const vendor = (formData.get("vendor") as string) || null;
  const payment_method = formData.get("payment_method") as string;
  const amount = Number(formData.get("amount"));
  const remarks = (formData.get("remarks") as string) || null;
  const files = formData
    .getAll("document")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const { data: matrixRows } = await supabase
    .from("approval_matrix")
    .select("min_amount, max_amount, required_role")
    .lte("min_amount", amount)
    .order("min_amount", { ascending: false });

  const tier = matrixRows?.find(
    (r) => r.max_amount === null || amount <= r.max_amount,
  );
  const required_approval_role: UserRole = tier?.required_role ?? "president";

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      date,
      portfolio_id,
      event_id,
      category_id,
      description,
      vendor,
      payment_method,
      amount,
      remarks,
      status: "pending_approval",
      submitted_by: user.id,
      required_approval_role,
      current_approver_role: APPROVAL_CHAIN[0],
    })
    .select()
    .single();

  if (error || !expense) {
    redirect(
      `/expenses/new?error=${encodeURIComponent(error?.message ?? "Failed to create expense")}`,
    );
  }

  for (const file of files) {
    const path = `${expense.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("expense-documents")
      .upload(path, file);

    if (!uploadError) {
      await supabase.from("expense_documents").insert({
        expense_id: expense.id,
        file_url: path,
      });
    }
  }

  await supabase.from("audit_log").insert({
    entity_type: "expense",
    entity_id: expense.id,
    action: "submitted",
    actor_id: user.id,
    details: { amount, required_approval_role },
  });

  redirect("/expenses");
}
