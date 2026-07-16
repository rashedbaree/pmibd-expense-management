"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APPROVAL_CHAIN } from "@/lib/approval";
import { DESCRIPTION_MAX_LENGTH, REMARKS_MAX_LENGTH } from "@/lib/constants";
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
  const description = (formData.get("description") as string).slice(
    0,
    DESCRIPTION_MAX_LENGTH,
  );
  const vendor = (formData.get("vendor") as string) || null;
  const payment_method = formData.get("payment_method") as string;
  const amount = Number(formData.get("amount"));
  const remarksRaw = (formData.get("remarks") as string) || null;
  const remarks = remarksRaw ? remarksRaw.slice(0, REMARKS_MAX_LENGTH) : null;
  const files = formData
    .getAll("document")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const { data: submitterProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const required_approval_role: UserRole = "president";
  const current_approver_role: UserRole =
    submitterProfile?.role === "finance_director"
      ? "president"
      : APPROVAL_CHAIN[0];

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
      current_approver_role,
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
