"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { CHEQUE_NUMBER_MAX_LENGTH } from "@/lib/constants";
import { parseTabularFile, parseFlexibleDate } from "@/lib/fileImport";
import type { PaymentMethod } from "@/lib/types";

export type ImportResult = {
  successCount: number;
  errors: string[];
};

const PAYMENT_METHOD_ALIASES: Record<string, PaymentMethod> = {
  cheque: "cheque",
  check: "cheque",
  bank_transfer: "bank_transfer",
  "bank transfer": "bank_transfer",
  banktransfer: "bank_transfer",
  cash: "cash",
};

export async function importExpenses(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return { successCount: 0, errors: ["Not authorized."] };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { successCount: 0, errors: ["No file selected."] };
  }

  const rows = await parseTabularFile(file);

  if (rows.length < 2) {
    return { successCount: 0, errors: ["File has no data rows."] };
  }

  const header = rows[0].cells.map((h) => h.trim().toLowerCase().replace(/\*$/, ""));
  const col = (name: string) => header.indexOf(name);

  const idx = {
    date: col("date"),
    portfolio: col("portfolio"),
    category: col("category"),
    event: col("event"),
    description: col("description"),
    vendor: col("vendor"),
    payment_method: col("payment_method"),
    amount: col("amount"),
    remarks: col("remarks"),
    submitted_by: col("submitted_by"),
    cheque_number: col("cheque_number"),
    entry_type: col("entry_type"),
  };

  const required = ["date", "portfolio", "category", "description", "payment_method", "amount"] as const;
  const missing = required.filter((key) => idx[key] === -1);
  if (missing.length > 0) {
    return {
      successCount: 0,
      errors: [
        `Missing required column(s): ${missing.join(", ")}`,
        `Columns detected in your file's header row: ${header.filter((h) => h).join(", ") || "(none — check the file isn't empty or corrupted)"}`,
      ],
    };
  }

  const supabase = await createClient();
  const [{ data: portfolios }, { data: categories }, { data: events }, { data: users }] =
    await Promise.all([
      supabase.from("portfolios").select("id, name"),
      supabase.from("expense_categories").select("id, name"),
      supabase.from("events").select("id, name, portfolio_id"),
      supabase.from("users").select("id, name, email"),
    ]);

  const portfolioByName = new Map(
    (portfolios ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );
  const categoryByName = new Map(
    (categories ?? []).map((c) => [c.name.trim().toLowerCase(), c.id as string]),
  );
  const eventByKey = new Map(
    (events ?? []).map((e) => [
      `${e.portfolio_id}:${e.name.trim().toLowerCase()}`,
      e.id as string,
    ]),
  );
  const userByEmail = new Map(
    (users ?? []).map((u) => [u.email.trim().toLowerCase(), u.id as string]),
  );

  const errors: string[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r].cells;
    const rowNum = rows[r].rowNumber;
    const get = (i: number) => (i === -1 ? "" : (row[i] ?? "").trim());

    const dateRaw = get(idx.date);
    const date = parseFlexibleDate(dateRaw);
    if (!date) {
      errors.push(`Row ${rowNum}: invalid date "${dateRaw}" (use YYYY-MM-DD or 1-Jul-25)`);
      continue;
    }

    const portfolioName = get(idx.portfolio);
    const portfolio_id = portfolioByName.get(portfolioName.toLowerCase());
    if (!portfolio_id) {
      errors.push(`Row ${rowNum}: unknown portfolio "${portfolioName}"`);
      continue;
    }

    const categoryName = get(idx.category);
    const category_id = categoryByName.get(categoryName.toLowerCase());
    if (!category_id) {
      errors.push(`Row ${rowNum}: unknown category "${categoryName}"`);
      continue;
    }

    const eventName = get(idx.event);
    let event_id: string | null = null;
    if (eventName) {
      event_id = eventByKey.get(`${portfolio_id}:${eventName.toLowerCase()}`) ?? null;
      if (!event_id) {
        errors.push(
          `Row ${rowNum}: unknown event "${eventName}" for portfolio "${portfolioName}"`,
        );
        continue;
      }
    }

    const description = get(idx.description);
    if (!description) {
      errors.push(`Row ${rowNum}: description is required`);
      continue;
    }

    const paymentRaw = get(idx.payment_method);
    const payment_method = PAYMENT_METHOD_ALIASES[paymentRaw.toLowerCase()];
    if (!payment_method) {
      errors.push(
        `Row ${rowNum}: invalid payment_method "${paymentRaw}" (use cheque, bank_transfer, or cash)`,
      );
      continue;
    }

    const amountRaw = get(idx.amount).replace(/,/g, "");
    const amount = Number(amountRaw);
    if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
      errors.push(`Row ${rowNum}: invalid amount "${amountRaw}"`);
      continue;
    }

    const entryTypeRaw = get(idx.entry_type).toLowerCase();
    const entry_type = entryTypeRaw || "expense";
    if (entry_type !== "expense" && entry_type !== "reversal") {
      errors.push(
        `Row ${rowNum}: invalid entry_type "${entryTypeRaw}" (use expense or reversal, or leave blank)`,
      );
      continue;
    }

    const submitterEmail = get(idx.submitted_by);
    const submitted_by = submitterEmail
      ? userByEmail.get(submitterEmail.toLowerCase())
      : profile.id;
    if (!submitted_by) {
      errors.push(`Row ${rowNum}: unknown submitted_by email "${submitterEmail}"`);
      continue;
    }

    const vendor = get(idx.vendor) || null;
    const remarks = get(idx.remarks) || null;
    const cheque_number =
      get(idx.cheque_number).slice(0, CHEQUE_NUMBER_MAX_LENGTH) || null;

    toInsert.push({
      date,
      portfolio_id,
      event_id,
      category_id,
      description,
      vendor,
      payment_method,
      amount,
      status: "paid",
      submitted_by,
      remarks,
      cheque_number,
      entry_type,
      required_approval_role: null,
      current_approver_role: null,
    });
  }

  if (toInsert.length === 0) {
    return { successCount: 0, errors };
  }

  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert(toInsert)
    .select("id, amount, cheque_number, entry_type");

  if (error) {
    return { successCount: 0, errors: [...errors, `Insert failed: ${error.message}`] };
  }

  if (inserted && inserted.length > 0) {
    await supabase.from("audit_log").insert(
      inserted.map((e) => ({
        entity_type: "expense",
        entity_id: e.id,
        action: "bulk_imported",
        actor_id: profile.id,
        details: {
          amount: e.amount,
          status: "paid",
          cheque_number: e.cheque_number,
          entry_type: e.entry_type,
        },
      })),
    );
  }

  return { successCount: inserted?.length ?? 0, errors };
}
