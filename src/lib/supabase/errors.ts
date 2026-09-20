// Supabase's PostgrestError carries more than `message` - `details`/`hint`
// usually name the specific constraint or RLS policy that failed, which is
// what actually helps diagnose a rejected insert/update in production.
export function describeError(
  error: { message: string; details?: string | null; hint?: string | null } | null,
  fallback: string,
): string {
  if (!error) return fallback;
  return [error.message, error.details, error.hint].filter(Boolean).join(" — ");
}
