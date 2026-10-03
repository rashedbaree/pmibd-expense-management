import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import type { AppUser } from "@/lib/types";

// Event check-in is administrators-only. The database enforces it too (RLS
// on the checkin_* tables uses is_admin()), but server actions and route
// handlers can be called directly, bypassing any page or layout, so each one
// checks here as well rather than trusting the menu.

/** The signed-in administrator, or null for anyone else. */
export async function getAdminProfile(): Promise<AppUser | null> {
  const profile = await getCurrentProfile();
  return profile?.role === "admin" ? profile : null;
}

/** For server actions: the administrator, or throws. */
export async function requireAdmin(): Promise<AppUser> {
  const profile = await getAdminProfile();
  if (!profile) throw new Error("Only administrators can use Event check in.");
  return profile;
}

/**
 * For route handlers: the administrator, or a ready-made 401/403 JSON
 * response to return as-is.
 */
export async function adminForRoute(): Promise<
  { profile: AppUser } | { response: NextResponse }
> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {
      response: NextResponse.json(
        { error: "Signed out - reload the page and sign in again." },
        { status: 401 },
      ),
    };
  }
  if (profile.role !== "admin") {
    return {
      response: NextResponse.json(
        { error: "Only administrators can use Event check in." },
        { status: 403 },
      ),
    };
  }
  return { profile };
}
