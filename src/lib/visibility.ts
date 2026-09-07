import type { createClient } from "@/lib/supabase/server";
import type { UserRole } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type VisibilityScope =
  | { fullVisibility: true }
  | {
      fullVisibility: false;
      portfolioId: string | null;
      ownOnly: boolean;
      userId: string | null;
    };

/**
 * By default a user only sees expenses in their own portfolio. Submitters
 * are scoped further, to just their own expenses - they don't need to see
 * what the rest of their portfolio submitted. Admins always see everything;
 * beyond that, both specific roles (e.g. President) and specific portfolios
 * (e.g. Finance & Audit) can be marked in Admin -> Expense Visibility to see
 * every portfolio's expenses instead.
 */
export async function getVisibilityScope(
  supabase: SupabaseClient,
  profile: { id: string; role: UserRole; portfolio_id: string | null } | null,
): Promise<VisibilityScope> {
  if (!profile) {
    return { fullVisibility: false, portfolioId: null, ownOnly: true, userId: null };
  }
  if (profile.role === "admin") return { fullVisibility: true };

  const { data: roleRow } = await supabase
    .from("role_full_visibility")
    .select("full_visibility")
    .eq("role", profile.role)
    .maybeSingle();
  if (roleRow?.full_visibility) return { fullVisibility: true };

  if (profile.portfolio_id) {
    const { data: portfolioRow } = await supabase
      .from("portfolios")
      .select("full_visibility")
      .eq("id", profile.portfolio_id)
      .maybeSingle();
    if (portfolioRow?.full_visibility) return { fullVisibility: true };
  }

  return {
    fullVisibility: false,
    portfolioId: profile.portfolio_id,
    ownOnly: profile.role === "submitter",
    userId: profile.id,
  };
}

/**
 * Applies a VisibilityScope's portfolio/own-expense restriction to any
 * Supabase query builder for a table with `portfolio_id` and `submitted_by`
 * columns (or a join whose expenses row is filtered the same way).
 */
export function scopeExpenseQuery<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  scope: VisibilityScope,
): T {
  if (scope.fullVisibility) return query;
  let scoped = query.eq("portfolio_id", scope.portfolioId ?? "__none__");
  if (scope.ownOnly) {
    scoped = scoped.eq("submitted_by", scope.userId ?? "__none__");
  }
  return scoped;
}
