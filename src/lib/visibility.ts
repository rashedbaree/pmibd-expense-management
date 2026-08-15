import type { createClient } from "@/lib/supabase/server";
import type { UserRole } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type VisibilityScope =
  | { fullVisibility: true }
  | { fullVisibility: false; portfolioId: string | null };

/**
 * By default a user only sees expenses in their own portfolio. Admins
 * always see everything; beyond that, both specific roles (e.g. President)
 * and specific portfolios (e.g. Finance & Audit) can be marked in Admin ->
 * Expense Visibility to see every portfolio's expenses instead.
 */
export async function getVisibilityScope(
  supabase: SupabaseClient,
  profile: { role: UserRole; portfolio_id: string | null } | null,
): Promise<VisibilityScope> {
  if (!profile) return { fullVisibility: false, portfolioId: null };
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

  return { fullVisibility: false, portfolioId: profile.portfolio_id };
}
