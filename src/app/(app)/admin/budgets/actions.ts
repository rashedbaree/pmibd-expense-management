"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const REQUIRED_COLUMNS = ["period", "portfolio", "category", "amount"];
const MAX_REPORTED_ERRORS = 20;

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/\*$/, "");
}

function lowerKeyedRow(rawRow: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    row[normalizeHeaderKey(key)] = value;
  }
  return row;
}

async function readWorkbookRows(file: File) {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
}

export async function importBudgets(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    redirect(
      `/admin/budgets?error=${encodeURIComponent("Only administrators can import budgets.")}`,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/admin/budgets?error=${encodeURIComponent("Please choose a CSV or Excel file.")}`,
    );
  }

  const rawRows = await readWorkbookRows(file);
  if (rawRows.length === 0) {
    redirect(`/admin/budgets?error=${encodeURIComponent("The file has no data rows.")}`);
  }

  const headerKeys = Object.keys(rawRows[0]).map(normalizeHeaderKey);
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headerKeys.includes(c));
  if (missingColumns.length > 0) {
    redirect(
      `/admin/budgets?error=${encodeURIComponent(`Missing required column(s): ${missingColumns.join(", ")}`)}`,
    );
  }

  const supabase = await createClient();
  const [{ data: portfolios }, { data: categories }, { data: periods }] = await Promise.all([
    supabase.from("portfolios").select("id, name"),
    supabase.from("expense_categories").select("id, name"),
    supabase.from("budget_periods").select("id, name"),
  ]);

  const portfolioMap = new Map(
    (portfolios ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );
  const categoryMap = new Map(
    (categories ?? []).map((c) => [c.name.trim().toLowerCase(), c.id as string]),
  );
  const periodMap = new Map(
    (periods ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );

  if (periodMap.size === 0) {
    redirect(
      `/admin/budgets?error=${encodeURIComponent("Add a budget period first (below) before importing.")}`,
    );
  }

  const toInsert: Record<string, unknown>[] = [];
  const errors: string[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNum = index + 2;
    const row = lowerKeyedRow(rawRow);

    const periodName = normalize(row.period);
    const portfolioName = normalize(row.portfolio);
    const categoryName = normalize(row.category);
    const amountRaw = normalize(row.amount);

    if (!periodName || !portfolioName || !categoryName || !amountRaw) {
      errors.push(`Row ${rowNum}: missing a required field.`);
      return;
    }

    const period_id = periodMap.get(periodName.toLowerCase());
    if (!period_id) {
      errors.push(`Row ${rowNum}: unknown period "${periodName}".`);
      return;
    }

    const portfolio_id = portfolioMap.get(portfolioName.toLowerCase());
    if (!portfolio_id) {
      errors.push(`Row ${rowNum}: unknown portfolio "${portfolioName}".`);
      return;
    }

    const category_id = categoryMap.get(categoryName.toLowerCase());
    if (!category_id) {
      errors.push(`Row ${rowNum}: unknown category "${categoryName}".`);
      return;
    }

    const amount = Number(amountRaw.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Row ${rowNum}: invalid amount "${amountRaw}".`);
      return;
    }

    toInsert.push({
      period_id,
      portfolio_id,
      category_id,
      initiative_name: normalize(row.initiative) || null,
      planned_date: normalize(row.planned_date) || null,
      amount,
      remarks: normalize(row.remarks) || null,
    });
  });

  // All-or-nothing, same convention as the expense/bank-statement importers
  // - a file with any invalid row imports nothing.
  let createdCount = 0;
  if (errors.length === 0 && toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("budgets")
      .insert(toInsert)
      .select("id");

    if (error) {
      errors.unshift(`Import failed: ${error.message}`);
    } else {
      createdCount = inserted?.length ?? 0;
    }
  }

  revalidatePath("/admin/budgets");
  revalidatePath("/reports/budget-vs-actual");

  const params = new URLSearchParams();
  params.set("created", String(createdCount));
  if (errors.length > 0) {
    params.set("errors", errors.slice(0, MAX_REPORTED_ERRORS).join("|"));
    if (errors.length > MAX_REPORTED_ERRORS) {
      params.set("moreErrors", String(errors.length - MAX_REPORTED_ERRORS));
    }
  }
  redirect(`/admin/budgets?${params.toString()}`);
}

export async function deleteBudget(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return;

  const id = formData.get("id") as string;
  const supabase = await createClient();
  await supabase.from("budgets").delete().eq("id", id);

  revalidatePath("/admin/budgets");
  revalidatePath("/reports/budget-vs-actual");
}

export async function addBudgetPeriod(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return;

  const name = (formData.get("name") as string).trim();
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;

  if (!name || !start_date || !end_date) {
    redirect(
      `/admin/budgets?error=${encodeURIComponent("Name, start date, and end date are all required.")}`,
    );
  }
  if (end_date < start_date) {
    redirect(
      `/admin/budgets?error=${encodeURIComponent("End date can't be before the start date.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_periods")
    .insert({ name, start_date, end_date });

  if (error) {
    redirect(`/admin/budgets?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/budgets");
  revalidatePath("/reports/budget-vs-actual");
}

export async function deleteBudgetPeriod(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return;

  const id = formData.get("id") as string;
  const supabase = await createClient();
  await supabase.from("budget_periods").delete().eq("id", id);

  revalidatePath("/admin/budgets");
  revalidatePath("/reports/budget-vs-actual");
}
