"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/checkin/access";
import { ATTENDEES_TABLE, fetchAllAttendees } from "@/lib/checkin/attendees";
import { TEAM_PREFIX, newTeamTicket, parseTeamLines } from "@/lib/checkin/team";

export interface TeamState {
  error?: string;
  added?: number;
  updated?: number;
  merged?: number;
  problems?: string[];
}

interface ExistingRow {
  id: string;
  email: string | null;
  ticket_number: string;
  is_team: boolean;
}

export async function addTeamMembers(
  _prev: TeamState | undefined,
  formData: FormData,
): Promise<TeamState> {
  await requireAdmin();

  const { rows, errors } = parseTeamLines(String(formData.get("list") ?? ""));
  if (!rows.length) {
    return {
      error: "Nothing to add. Write one person per line: Name, email, role",
      problems: errors,
    };
  }

  const supabase = await createClient();
  // Look across ALL attendees, not just existing team rows: someone pasted in
  // here may already be a paid, registered attendee under the same email.
  let existing: ExistingRow[];
  try {
    existing = await fetchAllAttendees<ExistingRow>(
      supabase,
      "id, email, ticket_number, is_team",
      "ticket_number",
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the attendee list." };
  }

  const byEmail = new Map(existing.map((r) => [r.email?.toLowerCase(), r]));
  const usedTickets = new Set(existing.map((r) => r.ticket_number));

  let updated = 0;
  let merged = 0;
  const inserts: Record<string, unknown>[] = [];
  for (const r of rows) {
    const found = byEmail.get(r.email);
    if (found) {
      // Already in the system, whether as a returning team member or as a
      // paid registrant. Flag them as team and keep their existing ticket
      // number (their real one, if they have one) instead of making a new
      // identity for the same person.
      const { error } = await supabase
        .from(ATTENDEES_TABLE)
        .update({ is_team: true, team_role: r.type, updated_at: new Date().toISOString() })
        .eq("id", found.id);
      if (error) return { error: error.message };
      if (found.is_team) updated++;
      else merged++;
      continue;
    }
    let ticket = newTeamTicket();
    while (usedTickets.has(ticket)) ticket = newTeamTicket();
    usedTickets.add(ticket);
    inserts.push({
      ticket_number: ticket,
      name: r.name,
      email: r.email,
      organization: "PMI Bangladesh Chapter",
      ticket_type: r.type,
      is_team: true,
      team_role: r.type,
      source: "import",
    });
  }

  if (inserts.length) {
    const { error } = await supabase.from(ATTENDEES_TABLE).insert(inserts);
    if (error) return { error: error.message };
  }

  revalidatePath("/event-checkin/team");
  return { added: inserts.length, updated, merged, problems: errors };
}

export async function removeTeamMember(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from(ATTENDEES_TABLE)
    .select("ticket_number")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  if ((row.ticket_number as string).startsWith(TEAM_PREFIX)) {
    // Exists only because they were added here: safe to remove entirely.
    await supabase.from(ATTENDEES_TABLE).delete().eq("id", id);
  } else {
    // A real registered attendee who was also on the team: keep them as an
    // attendee, just take the team flag off.
    await supabase
      .from(ATTENDEES_TABLE)
      .update({ is_team: false, team_role: null })
      .eq("id", id);
  }
  revalidatePath("/event-checkin/team");
}
