"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateUser(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const role = formData.get("role") as string;
  const portfolio_id = (formData.get("portfolio_id") as string) || null;
  const is_active = formData.get("is_active") === "on";

  await supabase
    .from("users")
    .update({ role, portfolio_id, is_active })
    .eq("id", id);

  revalidatePath("/admin/users");
}

export async function addUser(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim();
  const role = formData.get("role") as string;
  const portfolio_id = (formData.get("portfolio_id") as string) || null;

  await supabase
    .from("users")
    .insert({ id, name, email, role, portfolio_id, is_active: true });

  revalidatePath("/admin/users");
}

export async function addPortfolio(formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string).trim();
  await supabase.from("portfolios").insert({ name });
  revalidatePath("/admin/portfolios");
}

export async function deletePortfolio(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("portfolios").delete().eq("id", id);
  revalidatePath("/admin/portfolios");
}

export async function addCategory(formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string).trim();
  const parent_category_id = (formData.get("parent_category_id") as string) || null;
  await supabase.from("expense_categories").insert({ name, parent_category_id });
  revalidatePath("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("expense_categories").delete().eq("id", id);
  revalidatePath("/admin/categories");
}

export async function addEvent(formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string).trim();
  const date = formData.get("date") as string;
  const portfolio_id = formData.get("portfolio_id") as string;
  await supabase.from("events").insert({ name, date, portfolio_id });
  revalidatePath("/admin/events");
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("events").delete().eq("id", id);
  revalidatePath("/admin/events");
}

export async function updatePortfolioVisibility(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const full_visibility = formData.get("full_visibility") === "on";
  await supabase.from("portfolios").update({ full_visibility }).eq("id", id);
  revalidatePath("/admin/visibility");
}

export async function updateRoleVisibility(formData: FormData) {
  const supabase = await createClient();
  const role = formData.get("role") as string;
  if (role === "admin") return; // admins always have full visibility
  const full_visibility = formData.get("full_visibility") === "on";
  await supabase.from("role_full_visibility").update({ full_visibility }).eq("role", role);
  revalidatePath("/admin/visibility");
}

export async function addApprovalStep(formData: FormData) {
  const supabase = await createClient();
  const role = formData.get("role") as string;

  const { data: existingRoles } = await supabase
    .from("approval_chain_steps")
    .select("role");
  if ((existingRoles ?? []).some((r) => r.role === role)) {
    redirect(
      `/admin/approval-flow?error=${encodeURIComponent("That role is already in the chain.")}`,
    );
  }

  const { data: last } = await supabase
    .from("approval_chain_steps")
    .select("step_order")
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("approval_chain_steps")
    .insert({ role, step_order: (last?.step_order ?? 0) + 1 });

  revalidatePath("/admin/approval-flow");
}

export async function removeApprovalStep(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { count } = await supabase
    .from("approval_chain_steps")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) <= 1) {
    redirect(
      `/admin/approval-flow?error=${encodeURIComponent("The approval chain must have at least one step.")}`,
    );
  }

  await supabase.from("approval_chain_steps").delete().eq("id", id);
  revalidatePath("/admin/approval-flow");
}

export async function moveApprovalStep(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const direction = formData.get("direction") as "up" | "down";

  const { data: steps } = await supabase
    .from("approval_chain_steps")
    .select("id, step_order")
    .order("step_order", { ascending: true });
  if (!steps) return;

  const idx = steps.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= steps.length) return;

  const a = steps[idx];
  const b = steps[swapIdx];

  await supabase
    .from("approval_chain_steps")
    .update({ step_order: b.step_order })
    .eq("id", a.id);
  await supabase
    .from("approval_chain_steps")
    .update({ step_order: a.step_order })
    .eq("id", b.id);

  revalidatePath("/admin/approval-flow");
}
