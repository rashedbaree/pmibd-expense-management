"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextApproverRole } from "@/lib/approval";
import { CHEQUE_NUMBER_MAX_LENGTH, COMMENT_MAX_LENGTH } from "@/lib/constants";
import type { ExpenseStatus, UserRole } from "@/lib/types";

export async function actOnExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const expenseId = formData.get("expense_id") as string;
  const intent = formData.get("intent") as "approve" | "reject" | "return";
  const commentRaw = (formData.get("comment") as string) || null;
  const comment = commentRaw ? commentRaw.slice(0, COMMENT_MAX_LENGTH) : null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, portfolio_id")
    .eq("id", user.id)
    .single();

  const { data: expense } = await supabase
    .from("expenses")
    .select("status, portfolio_id, current_approver_role, required_approval_role")
    .eq("id", expenseId)
    .single();

  if (!profile || !expense) {
    redirect("/approvals?error=Expense+not+found");
  }

  if (expense.current_approver_role !== profile.role) {
    redirect("/approvals?error=Not+authorized+to+act+on+this+expense");
  }

  if (
    profile.role === "portfolio_director" &&
    expense.portfolio_id !== profile.portfolio_id
  ) {
    redirect("/approvals?error=Not+authorized+for+this+portfolio");
  }

  await supabase.from("expense_approvals").insert({
    expense_id: expenseId,
    approver_id: user.id,
    action: intent,
    comment,
  });

  let newStatus: ExpenseStatus = expense.status;
  let newCurrentRole: UserRole | null = expense.current_approver_role;

  if (intent === "reject") {
    newStatus = "rejected";
    newCurrentRole = null;
  } else if (intent === "return") {
    newStatus = "returned";
    newCurrentRole = null;
  } else if (intent === "approve") {
    const next = nextApproverRole(
      profile.role as UserRole,
      expense.required_approval_role as UserRole,
    );
    if (next) {
      newCurrentRole = next;
      newStatus = "pending_approval";
    } else {
      newStatus = "approved";
      newCurrentRole = null;
    }
  }

  await supabase
    .from("expenses")
    .update({ status: newStatus, current_approver_role: newCurrentRole })
    .eq("id", expenseId);

  await supabase.from("audit_log").insert({
    entity_type: "expense",
    entity_id: expenseId,
    action: intent,
    actor_id: user.id,
    details: { comment, new_status: newStatus },
  });

  revalidatePath("/approvals");
  revalidatePath("/expenses");
  redirect("/approvals");
}

export async function markAsPaid(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const expenseId = formData.get("expense_id") as string;
  const chequeNumberRaw = (formData.get("cheque_number") as string) || null;
  const cheque_number = chequeNumberRaw
    ? chequeNumberRaw.slice(0, CHEQUE_NUMBER_MAX_LENGTH)
    : null;

  await supabase
    .from("expenses")
    .update({ status: "paid", cheque_number })
    .eq("id", expenseId)
    .eq("status", "approved");

  await supabase.from("audit_log").insert({
    entity_type: "expense",
    entity_id: expenseId,
    action: "paid",
    actor_id: user.id,
    details: { cheque_number },
  });

  revalidatePath("/expenses");
  revalidatePath("/approvals");
  redirect("/approvals");
}
