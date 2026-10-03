"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/checkin/access";
import {
  ATTENDEES_TABLE,
  fetchAllAttendees,
  parseRegistrations,
} from "@/lib/checkin/attendees";

export interface MissingPerson {
  ticket: string;
  name: string;
  checkedIn: boolean;
  passEmailed: boolean;
}

export interface ImportReport {
  error?: string;
  totalRows?: number;
  paid?: number;
  skippedNotPaid?: number;
  skippedNoTicket?: number;
  added?: number;
  updated?: number;
  addedNames?: string[];
  duplicates?: { email: string; people: { ticket: string; name: string }[] }[];
  /** In the system, imported earlier, but not in this file. */
  missing?: MissingPerson[];
}

interface ExistingRow {
  ticket_number: string;
  name: string;
  source: string;
  is_team: boolean;
  checked_in_at: string | null;
  bag_given_at: string | null;
  pass_emailed_at: string | null;
}

export async function importRegistrations(
  _prev: ImportReport | undefined,
  formData: FormData,
): Promise<ImportReport> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the registrations .xlsx file first." };
  }

  let parsed;
  try {
    parsed = parseRegistrations(await file.arrayBuffer());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read that file." };
  }

  const supabase = await createClient();
  let existing: ExistingRow[];
  try {
    existing = await fetchAllAttendees<ExistingRow>(
      supabase,
      "ticket_number, name, source, is_team, checked_in_at, bag_given_at, pass_emailed_at",
      "ticket_number",
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the attendee list." };
  }
  const known = new Set(existing.map((r) => r.ticket_number));

  // Upsert touches only the columns below, so check-in / bag / email-sent
  // state of people already in the system is never reset by a re-import.
  const CHUNK = 200;
  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const { error } = await supabase
      .from(ATTENDEES_TABLE)
      .upsert(parsed.rows.slice(i, i + CHUNK), { onConflict: "ticket_number" });
    if (error) return { error: `Import stopped: ${error.message}` };
  }

  const added = parsed.rows.filter((r) => !known.has(r.ticket_number));

  const inFile = new Set(parsed.rows.map((r) => r.ticket_number));
  const missing: MissingPerson[] = existing
    .filter(
      (r) =>
        r.source === "import" &&
        !r.is_team && // team members stay regardless of what's in a new export
        !inFile.has(r.ticket_number),
    )
    .map((r) => ({
      ticket: r.ticket_number,
      name: r.name,
      checkedIn: !!r.checked_in_at || !!r.bag_given_at,
      passEmailed: !!r.pass_emailed_at,
    }));

  const byEmail = new Map<string, { ticket: string; name: string }[]>();
  for (const r of parsed.rows) {
    if (!r.email) continue;
    const list = byEmail.get(r.email) ?? [];
    list.push({ ticket: r.ticket_number, name: r.name });
    byEmail.set(r.email, list);
  }

  return {
    totalRows: parsed.totalRows,
    paid: parsed.rows.length,
    skippedNotPaid: parsed.skippedNotPaid,
    skippedNoTicket: parsed.skippedNoTicket,
    added: added.length,
    updated: parsed.rows.length - added.length,
    addedNames: added.slice(0, 50).map((r) => r.name),
    duplicates: [...byEmail.entries()]
      .filter(([, people]) => people.length > 1)
      .map(([email, people]) => ({ email, people })),
    missing,
  };
}

/**
 * Removes people the latest file no longer contains. Server-side guards: only
 * imported attendees, never a team member (even if their ticket looks like a
 * normal registration one), never anyone already checked in or given a bag,
 * whatever the caller sends.
 */
export async function removeMissing(
  tickets: string[],
): Promise<{ removed: number; error?: string }> {
  await requireAdmin();
  const safe = tickets.filter((t) => /^[A-Za-z0-9-]{1,40}$/.test(t));
  if (!safe.length) return { removed: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(ATTENDEES_TABLE)
    .delete()
    .in("ticket_number", safe)
    .eq("source", "import")
    .eq("is_team", false)
    .is("checked_in_at", null)
    .is("bag_given_at", null)
    .select("id");
  if (error) return { removed: 0, error: error.message };
  return { removed: data?.length ?? 0 };
}
