"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/checkin/access";
import { ATTENDEES_TABLE, SCAN_LOG_TABLE } from "@/lib/checkin/attendees";

export interface ResetState {
  error?: string;
  done?: { checkedIn: number; bags: number; walkIns: number; scans: number };
}

/**
 * Clears everything a trial run created: check-ins, bag hand-outs, walk-ins
 * and the scan log. Attendees, team members and "pass emailed" status stay.
 */
export async function resetTestData(
  _prev: ResetState | undefined,
  formData: FormData,
): Promise<ResetState> {
  await requireAdmin();
  if (String(formData.get("confirm") ?? "").trim() !== "RESET") {
    return { error: "Type RESET (capital letters) to confirm." };
  }

  const supabase = await createClient();
  const cleared = {
    checked_in_at: null,
    checked_in_by: null,
    bag_given_at: null,
    bag_given_by: null,
    updated_at: new Date().toISOString(),
  };

  const { count: checkedIn } = await supabase
    .from(ATTENDEES_TABLE)
    .select("id", { count: "exact", head: true })
    .not("checked_in_at", "is", null);
  const { count: bags } = await supabase
    .from(ATTENDEES_TABLE)
    .select("id", { count: "exact", head: true })
    .not("bag_given_at", "is", null);

  // Walk-ins go first: they exist only because of a scan session.
  const { data: walkIns, error: walkInError } = await supabase
    .from(ATTENDEES_TABLE)
    .delete()
    .eq("source", "walkin")
    .select("id");
  if (walkInError) return { error: walkInError.message };

  for (const col of ["checked_in_at", "bag_given_at"] as const) {
    const { error } = await supabase.from(ATTENDEES_TABLE).update(cleared).not(col, "is", null);
    if (error) return { error: error.message };
  }

  const { data: scans, error: scanError } = await supabase
    .from(SCAN_LOG_TABLE)
    .delete()
    .gte("id", 0)
    .select("id");
  if (scanError) return { error: scanError.message };

  revalidatePath("/event-checkin/reset");
  return {
    done: {
      checkedIn: checkedIn ?? 0,
      bags: bags ?? 0,
      walkIns: walkIns?.length ?? 0,
      scans: scans?.length ?? 0,
    },
  };
}
