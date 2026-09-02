import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "./email";
import type { UserRole } from "./types";

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type ExpenseSummary = {
  description: string;
  amount: number;
  date: string;
  portfolioName: string | null;
  submitterName: string | null;
  overBudget?: boolean;
};

// Notifies whoever currently holds `role` that an expense is waiting on
// them. Looks up active users with that role at send time, rather than
// storing an address on the expense - so it always reaches whoever holds
// the role today, even if that person changes later.
export async function notifyApprover(
  supabase: SupabaseClient,
  role: UserRole,
  expense: ExpenseSummary,
) {
  const { data: approvers, error } = await supabase
    .from("users")
    .select("email")
    .eq("role", role)
    .eq("is_active", true);

  if (error) {
    console.error(`notifyApprover: looking up ${role} users failed:`, error.message);
    return;
  }

  const emails = (approvers ?? []).map((u) => u.email).filter(Boolean);
  if (emails.length === 0) return;

  const origin = await getOrigin();
  const amount = Number(expense.amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  });

  const html = `
    <p>An expense is waiting for your approval.</p>
    ${
      expense.overBudget
        ? `<p style="color:#b91c1c;font-weight:bold;">⚠ This expense exceeds the budgeted amount for its portfolio/category and requires Finance Director approval.</p>`
        : ""
    }
    <table cellpadding="4" style="border-collapse: collapse;">
      <tr><td><strong>Submitted by</strong></td><td>${expense.submitterName ?? "-"}</td></tr>
      <tr><td><strong>Portfolio</strong></td><td>${expense.portfolioName ?? "-"}</td></tr>
      <tr><td><strong>Date</strong></td><td>${expense.date}</td></tr>
      <tr><td><strong>Amount</strong></td><td>${amount} BDT</td></tr>
      <tr><td><strong>Description</strong></td><td>${expense.description}</td></tr>
    </table>
    <p><a href="${origin}/approvals">Review it on the Approvals page</a></p>
    <p style="color:#666;font-size:12px;">PMI Bangladesh Expense Management System</p>
  `;

  await sendMail(
    emails,
    expense.overBudget ? "Over-budget expense pending your approval" : "Expense pending your approval",
    html,
  );
}

// Notifies the submitter that their expense was returned, with the
// approver's comment (if any) and a link straight to the edit/resubmit
// page for that specific expense.
export async function notifySubmitterOfReturn(
  supabase: SupabaseClient,
  submitterEmail: string | null,
  expenseId: string,
  expense: ExpenseSummary,
  comment: string | null,
) {
  if (!submitterEmail) return;

  const origin = await getOrigin();
  const amount = Number(expense.amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  });

  const html = `
    <p>Your expense was returned for correction.</p>
    <table cellpadding="4" style="border-collapse: collapse;">
      <tr><td><strong>Portfolio</strong></td><td>${expense.portfolioName ?? "-"}</td></tr>
      <tr><td><strong>Date</strong></td><td>${expense.date}</td></tr>
      <tr><td><strong>Amount</strong></td><td>${amount} BDT</td></tr>
      <tr><td><strong>Description</strong></td><td>${expense.description}</td></tr>
      ${comment ? `<tr><td><strong>Reason</strong></td><td>${comment}</td></tr>` : ""}
    </table>
    <p><a href="${origin}/expenses/${expenseId}/edit">Edit and resubmit it</a></p>
    <p style="color:#666;font-size:12px;">PMI Bangladesh Expense Management System</p>
  `;

  await sendMail([submitterEmail], "Your expense was returned", html);
}
