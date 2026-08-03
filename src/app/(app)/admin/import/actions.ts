"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  CHEQUE_NUMBER_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  REMARKS_MAX_LENGTH,
} from "@/lib/constants";
import type { EntryType, PaymentMethod } from "@/lib/types";

const PAYMENT_METHODS: PaymentMethod[] = ["cheque", "bank_transfer", "cash"];
const ENTRY_TYPES: EntryType[] = ["expense", "reversal"];
const REQUIRED_COLUMNS = [
  "date",
  "portfolio",
  "category",
  "description",
  "payment_method",
  "amount",
];
const MAX_REPORTED_ERRORS = 20;

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function parseImportDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!match) return null;

  const [, day, monthAbbr, yy] = match;
  const month = MONTHS[monthAbbr.toLowerCase()];
  if (!month) return null;

  return `20${yy}-${month}-${day.padStart(2, "0")}`;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function redirectWithError(message: string): never {
  redirect(`/admin/import?error=${encodeURIComponent(message)}`);
}

export async function importExpenses(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    redirectWithError("Only administrators can import expenses.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirectWithError("Please choose a CSV or Excel file.");
  }

  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    redirectWithError("The file has no data rows.");
  }

  const headerKeys = Object.keys(rawRows[0]).map((k) => k.trim().toLowerCase());
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headerKeys.includes(c));
  if (missingColumns.length > 0) {
    redirectWithError(`Missing required column(s): ${missingColumns.join(", ")}`);
  }

  const supabase = await createClient();
  const [
    { data: portfolios },
    { data: categories },
    { data: events },
    { data: users },
  ] = await Promise.all([
    supabase.from("portfolios").select("id, name"),
    supabase.from("expense_categories").select("id, name"),
    supabase.from("events").select("id, name, portfolio_id"),
    supabase.from("users").select("id, email"),
  ]);

  const portfolioMap = new Map(
    (portfolios ?? []).map((p) => [p.name.toLowerCase(), p.id as string]),
  );
  const categoryMap = new Map(
    (categories ?? []).map((c) => [c.name.toLowerCase(), c.id as string]),
  );
  const eventMap = new Map(
    (events ?? []).map((e) => [
      `${e.portfolio_id}:${e.name.toLowerCase()}`,
      e.id as string,
    ]),
  );
  const userMap = new Map(
    (users ?? []).map((u) => [u.email.toLowerCase(), u.id as string]),
  );

  const toInsert: Record<string, unknown>[] = [];
  const errors: string[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNum = index + 2; // +1 for 0-index, +1 for the header row
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      row[key.trim().toLowerCase()] = value;
    }

    const dateRaw = normalize(row.date);
    const portfolioName = normalize(row.portfolio);
    const categoryName = normalize(row.category);
    const description = normalize(row.description);
    const paymentMethodRaw = normalize(row.payment_method).toLowerCase();
    const amountRaw = normalize(row.amount);

    if (
      !dateRaw ||
      !portfolioName ||
      !categoryName ||
      !description ||
      !paymentMethodRaw ||
      !amountRaw
    ) {
      errors.push(`Row ${rowNum}: missing a required field.`);
      return;
    }

    const date = parseImportDate(dateRaw);
    if (!date) {
      errors.push(`Row ${rowNum}: unrecognized date "${dateRaw}".`);
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

    if (!PAYMENT_METHODS.includes(paymentMethodRaw as PaymentMethod)) {
      errors.push(`Row ${rowNum}: invalid payment_method "${paymentMethodRaw}".`);
      return;
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Row ${rowNum}: invalid amount "${amountRaw}".`);
      return;
    }

    const eventName = normalize(row.event);
    let event_id: string | null = null;
    if (eventName) {
      event_id = eventMap.get(`${portfolio_id}:${eventName.toLowerCase()}`) ?? null;
      if (!event_id) {
        errors.push(
          `Row ${rowNum}: unknown event "${eventName}" for portfolio "${portfolioName}".`,
        );
        return;
      }
    }

    const submittedByRaw = normalize(row.submitted_by);
    let submitted_by = profile.id;
    if (submittedByRaw) {
      const found = userMap.get(submittedByRaw.toLowerCase());
      if (!found) {
        errors.push(`Row ${rowNum}: unknown submitted_by email "${submittedByRaw}".`);
        return;
      }
      submitted_by = found;
    }

    const entryTypeRaw = normalize(row.entry_type).toLowerCase() || "expense";
    if (!ENTRY_TYPES.includes(entryTypeRaw as EntryType)) {
      errors.push(`Row ${rowNum}: invalid entry_type "${entryTypeRaw}".`);
      return;
    }

    const vendor = normalize(row.vendor) || null;
    const remarksRaw = normalize(row.remarks);
    const remarks = remarksRaw ? remarksRaw.slice(0, REMARKS_MAX_LENGTH) : null;
    const chequeNumberRaw = normalize(row.cheque_number);
    const cheque_number = chequeNumberRaw
      ? chequeNumberRaw.slice(0, CHEQUE_NUMBER_MAX_LENGTH)
      : null;

    toInsert.push({
      date,
      portfolio_id,
      event_id,
      category_id,
      description: description.slice(0, DESCRIPTION_MAX_LENGTH),
      vendor,
      payment_method: paymentMethodRaw,
      amount,
      remarks,
      cheque_number,
      entry_type: entryTypeRaw,
      status: "paid",
      submitted_by,
    });
  });

  let createdCount = 0;
  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("expenses")
      .insert(toInsert)
      .select("id");

    if (error) {
      errors.unshift(`Import failed: ${error.message}`);
    } else {
      createdCount = inserted?.length ?? 0;
      if (inserted && inserted.length > 0) {
        await supabase.from("audit_log").insert(
          inserted.map((row) => ({
            entity_type: "expense",
            entity_id: row.id,
            action: "imported",
            actor_id: profile.id,
          })),
        );
      }
    }
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  const params = new URLSearchParams();
  params.set("created", String(createdCount));
  if (errors.length > 0) {
    params.set("errors", errors.slice(0, MAX_REPORTED_ERRORS).join("|"));
    if (errors.length > MAX_REPORTED_ERRORS) {
      params.set("moreErrors", String(errors.length - MAX_REPORTED_ERRORS));
    }
  }
  redirect(`/admin/import?${params.toString()}`);
}
