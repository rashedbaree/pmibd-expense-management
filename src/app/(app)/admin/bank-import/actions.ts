"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { parseTabularFile, parseFlexibleDate, normalizeHeader } from "@/lib/fileImport";

export type BankImportResult = {
  successCount: number;
  duplicateCount: number;
  errors: string[];
};

const COLUMN_ALIASES = {
  trans_date: ["trans date", "transaction date", "date"],
  cheque_number: ["cheque", "cheque no", "cheque number"],
  ref: ["ref"],
  narration: ["narration"],
  trans_details: ["trans details", "transaction details", "details"],
  debit: ["debit"],
  credit: ["credit"],
  balance: ["balance"],
} as const;

function findCol(header: string[], aliases: readonly string[]): number {
  for (const alias of aliases) {
    const i = header.indexOf(alias);
    if (i !== -1) return i;
  }
  return -1;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

export async function importBankTransactions(
  _prev: BankImportResult,
  formData: FormData,
): Promise<BankImportResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return { successCount: 0, duplicateCount: 0, errors: ["Not authorized."] };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { successCount: 0, duplicateCount: 0, errors: ["No file selected."] };
  }

  const rows = await parseTabularFile(file);
  if (rows.length < 2) {
    return { successCount: 0, duplicateCount: 0, errors: ["File has no data rows."] };
  }

  const header = rows[0].cells.map(normalizeHeader);
  const idx = {
    trans_date: findCol(header, COLUMN_ALIASES.trans_date),
    cheque_number: findCol(header, COLUMN_ALIASES.cheque_number),
    ref: findCol(header, COLUMN_ALIASES.ref),
    narration: findCol(header, COLUMN_ALIASES.narration),
    trans_details: findCol(header, COLUMN_ALIASES.trans_details),
    debit: findCol(header, COLUMN_ALIASES.debit),
    credit: findCol(header, COLUMN_ALIASES.credit),
    balance: findCol(header, COLUMN_ALIASES.balance),
  };

  const missing = (["trans_date", "balance"] as const).filter((key) => idx[key] === -1);
  if (missing.length > 0) {
    return {
      successCount: 0,
      duplicateCount: 0,
      errors: [
        `Missing required column(s): ${missing.join(", ")}`,
        `Columns detected in your file's header row: ${header.filter((h) => h).join(", ") || "(none — check the file isn't empty or corrupted)"}`,
      ],
    };
  }

  const errors: string[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r].cells;
    const rowNum = rows[r].rowNumber;
    const get = (i: number) => (i === -1 ? "" : (row[i] ?? "").trim());

    const dateRaw = get(idx.trans_date);
    if (!dateRaw) {
      // No date at all — a statement's trailing totals/footer row, not a
      // transaction. Skip quietly rather than reporting it as an issue.
      continue;
    }
    const trans_date = parseFlexibleDate(dateRaw);
    if (!trans_date) {
      errors.push(`Row ${rowNum}: invalid date "${dateRaw}" (use YYYY-MM-DD, 1-Jul-25, or DD/MM/YYYY)`);
      continue;
    }

    const balanceRaw = get(idx.balance);
    const balance = parseAmount(balanceRaw);
    if (balance === null) {
      errors.push(`Row ${rowNum}: invalid balance "${balanceRaw}"`);
      continue;
    }

    const debit = parseAmount(get(idx.debit));
    const credit = parseAmount(get(idx.credit));
    if (debit === null && credit === null) {
      errors.push(`Row ${rowNum}: must have a debit or credit amount`);
      continue;
    }

    toInsert.push({
      trans_date,
      cheque_number: get(idx.cheque_number) || null,
      ref: get(idx.ref) || null,
      narration: get(idx.narration) || null,
      trans_details: get(idx.trans_details) || null,
      debit,
      credit,
      balance,
      source_file: file.name,
    });
  }

  if (toInsert.length === 0) {
    return { successCount: 0, duplicateCount: 0, errors };
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("bank_transactions")
    .upsert(toInsert, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return {
      successCount: 0,
      duplicateCount: 0,
      errors: [...errors, `Insert failed: ${error.message}`],
    };
  }

  const successCount = inserted?.length ?? 0;
  return {
    successCount,
    duplicateCount: toInsert.length - successCount,
    errors,
  };
}
