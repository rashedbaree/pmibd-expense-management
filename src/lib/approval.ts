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

export function startApproval(submitterRole: UserRole | undefined): {
  required_approval_role: UserRole;
  current_approver_role: UserRole;
} {
  const required_approval_role: UserRole = "president";
  const current_approver_role: UserRole =
    submitterRole === "finance_director" ? "president" : APPROVAL_CHAIN[0];
  return { required_approval_role, current_approver_role };
}
