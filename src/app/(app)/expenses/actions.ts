"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startApproval } from "@/lib/approval";
import { notifyApprover } from "@/lib/notifications";
import { DESCRIPTION_MAX_LENGTH, REMARKS_MAX_LENGTH } from "@/lib/constants";

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

  const [{ data: submitterProfile }, { data: portfolio }] = await Promise.all([
    supabase.from("users").select("role, name").eq("id", user.id).single(),
    supabase.from("portfolios").select("name").eq("id", portfolio_id).single(),
  ]);

  const { required_approval_role, current_approver_role } = startApproval(
    submitterProfile?.role,
  );

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

  await notifyApprover(supabase, current_approver_role, {
    description,
    amount,
    date,
    portfolioName: portfolio?.name ?? null,
    submitterName: submitterProfile?.name ?? null,
  });

  redirect("/expenses");
}

export async function createReversal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const originalId = formData.get("expense_id") as string;
  const remarksRaw = ((formData.get("remarks") as string) || "").trim();
  const remarks = remarksRaw.slice(0, REMARKS_MAX_LENGTH);

  if (!remarks) {
    redirect(
      `/expenses/${originalId}/reverse?error=${encodeURIComponent("A reason for the reversal is required")}`,
    );
  }

  const { data: original } = await supabase
    .from("expenses")
    .select(
      "id, date, portfolio_id, event_id, category_id, description, vendor, payment_method, amount, status, entry_type",
    )
    .eq("id", originalId)
    .single();

  if (
    !original ||
    original.entry_type !== "expense" ||
    (original.status !== "approved" && original.status !== "paid")
  ) {
    redirect(
      `/expenses?error=${encodeURIComponent("This expense can't be reversed")}`,
    );
  }

  const { data: existingReversal } = await supabase
    .from("expenses")
    .select("id")
    .eq("reverses_expense_id", originalId)
    .maybeSingle();

  if (existingReversal) {
    redirect(
      `/expenses?error=${encodeURIComponent("This expense has already been reversed")}`,
    );
  }

  const [{ data: submitterProfile }, { data: portfolio }] = await Promise.all([
    supabase.from("users").select("role, name").eq("id", user.id).single(),
    supabase.from("portfolios").select("name").eq("id", original.portfolio_id).single(),
  ]);

  const { required_approval_role, current_approver_role } = startApproval(
    submitterProfile?.role,
  );

  const description = `Reversal: ${original.description}`.slice(
    0,
    DESCRIPTION_MAX_LENGTH,
  );

  const { data: reversal, error } = await supabase
    .from("expenses")
    .insert({
      date: new Date().toISOString().slice(0, 10),
      portfolio_id: original.portfolio_id,
      event_id: original.event_id,
      category_id: original.category_id,
      description,
      vendor: original.vendor,
      payment_method: original.payment_method,
      amount: original.amount,
      remarks,
      status: "pending_approval",
      submitted_by: user.id,
      required_approval_role,
      current_approver_role,
      entry_type: "reversal",
      reverses_expense_id: originalId,
    })
    .select()
    .single();

  if (error || !reversal) {
    redirect(
      `/expenses/${originalId}/reverse?error=${encodeURIComponent(error?.message ?? "Failed to create reversal")}`,
    );
  }

  await supabase.from("audit_log").insert({
    entity_type: "expense",
    entity_id: reversal.id,
    action: "reversal_submitted",
    actor_id: user.id,
    details: { reverses_expense_id: originalId, amount: original.amount },
  });

  await notifyApprover(supabase, current_approver_role, {
    description,
    amount: original.amount,
    date: reversal.date,
    portfolioName: portfolio?.name ?? null,
    submitterName: submitterProfile?.name ?? null,
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}
