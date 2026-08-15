import type { ExpenseEntryType } from "./types";

export function signedAmount(e: { amount: number; entry_type: ExpenseEntryType }) {
  const amount = Number(e.amount);
  return e.entry_type === "reversal" ? -amount : amount;
}
