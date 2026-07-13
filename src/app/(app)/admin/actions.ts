"use server";

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

export async function addPortfolio(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
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
  const name = formData.get("name") as string;
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
  const name = formData.get("name") as string;
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

export async function addApprovalMatrixRow(formData: FormData) {
  const supabase = await createClient();
  const min_amount = Number(formData.get("min_amount"));
  const maxRaw = formData.get("max_amount") as string;
  const max_amount = maxRaw ? Number(maxRaw) : null;
  const required_role = formData.get("required_role") as string;

  await supabase
    .from("approval_matrix")
    .insert({ min_amount, max_amount, required_role });

  revalidatePath("/admin/approval-matrix");
}

export async function deleteApprovalMatrixRow(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("approval_matrix").delete().eq("id", id);
  revalidatePath("/admin/approval-matrix");
}
