import type { UserRole } from "./types";

export const APPROVAL_CHAIN: UserRole[] = ["finance_director", "president"];

export function nextApproverRole(
  current: UserRole,
  required: UserRole,
): UserRole | null {
  if (current === required) return null;
  const idx = APPROVAL_CHAIN.indexOf(current);
  return APPROVAL_CHAIN[idx + 1] ?? null;
}
