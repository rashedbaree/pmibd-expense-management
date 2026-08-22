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
