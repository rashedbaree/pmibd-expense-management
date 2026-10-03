import { createClient } from "@/lib/supabase/server";
import {
  ATTENDEES_TABLE,
  PUBLIC_COLUMNS,
  SCAN_LOG_TABLE,
  type PublicAttendee,
} from "@/lib/checkin/attendees";

export type Station = "checkin" | "bag";

export type ScanResult =
  | { result: "ok"; attendee: PublicAttendee; note?: string }
  | { result: "already"; attendee: PublicAttendee; at: string; by: string | null }
  | { result: "notfound"; code: string };

/** QR/barcode text -> ticket number. Tolerates URLs or stray whitespace. */
export function normalizeCode(raw: string) {
  const parts = raw.trim().split(/[\s/?#=]+/).filter(Boolean);
  return (parts.pop() ?? "").toUpperCase();
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function duplicateEmailNote(
  sb: SupabaseClient,
  a: PublicAttendee,
  station: Station,
): Promise<string | undefined> {
  if (!a.email) return undefined;
  const column = station === "bag" ? "bag_given_at" : "checked_in_at";
  const { data } = await sb
    .from(ATTENDEES_TABLE)
    .select("name, ticket_number")
    .eq("email", a.email)
    .neq("id", a.id)
    .not(column, "is", null)
    .limit(1);
  if (!data?.length) return undefined;
  const verb = station === "bag" ? "already collected a bag" : "already checked in";
  return `Same email (${a.email}) ${verb} on ticket ${data[0].ticket_number} (${data[0].name}). Check this isn't a duplicate.`;
}

export async function processScan(
  rawCode: string,
  station: Station,
  staff: string,
): Promise<ScanResult> {
  const code = normalizeCode(rawCode);
  const sb = await createClient();

  const { data: found, error } = await sb
    .from(ATTENDEES_TABLE)
    .select(PUBLIC_COLUMNS)
    .eq("ticket_number", code)
    .maybeSingle<PublicAttendee>();
  if (error) throw new Error(error.message);

  const log = async (result: string, attendeeId: string | null) => {
    await sb.from(SCAN_LOG_TABLE).insert({
      ticket_number: code,
      attendee_id: attendeeId,
      station,
      result,
      staff,
    });
  };

  if (!found) {
    await log("notfound", null);
    return { result: "notfound", code: rawCode.trim().slice(0, 60) };
  }

  const now = new Date().toISOString();
  const atCol = station === "bag" ? "bag_given_at" : "checked_in_at";
  const byCol = station === "bag" ? "bag_given_by" : "checked_in_by";

  // Single conditional UPDATE: if two volunteers scan the same ticket at the
  // same moment, only one update succeeds and the other sees "already".
  const { data: updated, error: updateError } = await sb
    .from(ATTENDEES_TABLE)
    .update({ [atCol]: now, [byCol]: staff, updated_at: now })
    .eq("id", found.id)
    .is(atCol, null)
    .select(PUBLIC_COLUMNS)
    .maybeSingle<PublicAttendee>();
  if (updateError) throw new Error(updateError.message);

  if (!updated) {
    await log("already", found.id);
    const at = (station === "bag" ? found.bag_given_at : found.checked_in_at) ?? now;
    const by = station === "bag" ? found.bag_given_by : found.checked_in_by;
    return { result: "already", attendee: found, at, by };
  }

  // Handing over a bag implies they're in the building: register them too if
  // the booth step was skipped.
  let attendee = updated;
  if (station === "bag" && !updated.checked_in_at) {
    const { data: both } = await sb
      .from(ATTENDEES_TABLE)
      .update({ checked_in_at: now, checked_in_by: staff, updated_at: now })
      .eq("id", found.id)
      .is("checked_in_at", null)
      .select(PUBLIC_COLUMNS)
      .maybeSingle<PublicAttendee>();
    if (both) attendee = both;
  }

  await log("ok", found.id);
  return { result: "ok", attendee, note: await duplicateEmailNote(sb, attendee, station) };
}

export type UndoResult =
  | { result: "undone"; attendee: PublicAttendee }
  | { result: "notfound" };

/**
 * Reverts a mistaken scan. Undoing a check-in only ever clears check-in.
 * Undoing a bag also clears check-in, but only if it was set at the exact
 * same moment as the bag (i.e. auto-checked-in by that same bag scan) - an
 * earlier, separate, legitimate check-in is never touched.
 */
export async function undoScan(
  ticketNumber: string,
  station: Station,
  staff: string,
): Promise<UndoResult> {
  const code = normalizeCode(ticketNumber);
  const sb = await createClient();

  const { data: found, error } = await sb
    .from(ATTENDEES_TABLE)
    .select(PUBLIC_COLUMNS)
    .eq("ticket_number", code)
    .maybeSingle<PublicAttendee>();
  if (error) throw new Error(error.message);
  if (!found) return { result: "notfound" };

  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (station === "bag") {
    patch.bag_given_at = null;
    patch.bag_given_by = null;
    if (found.checked_in_at && found.checked_in_at === found.bag_given_at) {
      patch.checked_in_at = null;
      patch.checked_in_by = null;
    }
  } else {
    patch.checked_in_at = null;
    patch.checked_in_by = null;
  }

  const { data: updated, error: updateError } = await sb
    .from(ATTENDEES_TABLE)
    .update(patch)
    .eq("id", found.id)
    .select(PUBLIC_COLUMNS)
    .maybeSingle<PublicAttendee>();
  if (updateError) throw new Error(updateError.message);

  await sb.from(SCAN_LOG_TABLE).insert({
    ticket_number: code,
    attendee_id: found.id,
    station,
    result: "undo",
    staff,
  });

  return { result: "undone", attendee: updated ?? found };
}
