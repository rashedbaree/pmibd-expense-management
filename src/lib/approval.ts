import type { createClient } from "./supabase/server";
import type { UserRole } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const DEFAULT_APPROVAL_CHAIN: UserRole[] = ["finance_director", "president"];

export async function getApprovalChain(
  supabase: SupabaseClient,
): Promise<UserRole[]> {
  const { data } = await supabase
    .from("approval_chain_steps")
    .select("role")
    .order("step_order", { ascending: true });

  const roles = (data ?? []).map((r) => r.role as UserRole);
  return roles.length > 0 ? roles : DEFAULT_APPROVAL_CHAIN;
}

export function nextApproverRole(
  chain: UserRole[],
  current: UserRole,
  required: UserRole,
): UserRole | null {
  if (current === required) return null;
  const idx = chain.indexOf(current);
  return chain[idx + 1] ?? null;
}

// Guarantees a finance_director sign-off on an over-budget expense even if
// the admin-configured chain doesn't include that role. Leaves the chain
// untouched when it already does - finance_director then approves at their
// normal step, same as any other expense.
export function chainWithMandatoryFinanceApproval(
  chain: UserRole[],
  overBudget: boolean,
): UserRole[] {
  if (!overBudget || chain.includes("finance_director")) return chain;
  return [...chain, "finance_director"];
}

export function startApproval(
  chain: UserRole[],
  submitterRole: UserRole | undefined,
): {
  required_approval_role: UserRole;
  current_approver_role: UserRole;
} {
  const required_approval_role = chain[chain.length - 1];
  // A submitter who is themselves the chain's first approver skips
  // approving their own expense and it starts one step further in.
  const current_approver_role =
    submitterRole && submitterRole === chain[0] ? (chain[1] ?? chain[0]) : chain[0];
  return { required_approval_role, current_approver_role };
}
