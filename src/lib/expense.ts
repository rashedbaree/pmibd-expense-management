import type { EntryType } from "./types";

export function signedAmount(e: { amount: number; entry_type: EntryType }) {
  const amount = Number(e.amount);
  return e.entry_type === "reversal" ? -amount : amount;
}
