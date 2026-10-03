"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/checkin/access";
import { ATTENDEES_TABLE } from "@/lib/checkin/attendees";
import { sendPassEmail, smtpConfigured } from "@/lib/checkin/mail";
import { isScope, type SendScope } from "@/lib/checkin/passes";

export interface TestResult {
  ok: boolean;
  message: string;
}

const cleanNote = (note: unknown) => (typeof note === "string" ? note.slice(0, 600) : "");

/** Sends a sample pass to one address (no attendee is marked as sent). */
export async function sendTestPass(email: string, note = ""): Promise<TestResult> {
  await requireAdmin();
  const to = email.trim();
  if (!/^\S+@\S+\.\S+$/.test(to)) return { ok: false, message: "Enter a valid email address." };
  if (!smtpConfigured()) return { ok: false, message: "SMTP is not configured on the server." };
  try {
    await sendPassEmail(
      to,
      "Sample Attendee",
      "BPMS26TICKET0000",
      { organization: "Sample Organisation Ltd", designation: "Project Manager", type: "Single" },
      cleanNote(note),
    );
    return { ok: true, message: `Test pass sent to ${to}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Send failed." };
  }
}

export interface BatchResult {
  sent: number;
  failed: { ticket: string; name: string; email: string; error: string }[];
  remaining: number;
  error?: string;
}

// Larger than you might expect on purpose: each server call only logs in to
// the mail server once and reuses that connection for the whole batch, so
// fewer, bigger batches means far fewer logins overall. Too many separate
// logins in a short time is what triggers providers' "too many login
// attempts" block (Gmail did exactly that during the first big send) - this
// is the main lever against that, alongside the small delay between sends.
const BATCH_SIZE = 15;
const DELAY_BETWEEN_SENDS_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Emails the next few people in `scope` who haven't had their pass yet.
 * Called repeatedly by the page so each request stays short and a
 * stop/refresh just resumes where it left off.
 */
export async function sendPassBatch(
  skipTickets: string[] = [],
  scope: SendScope = "registered",
  note = "",
): Promise<BatchResult> {
  await requireAdmin();
  const supabase = await createClient();
  const which = isScope(scope) ? scope : "registered";
  // Ticket numbers are interpolated into a PostgREST filter: keep them tame.
  const skip = skipTickets.filter((t) => /^[A-Za-z0-9-]{1,40}$/.test(t));

  if (!smtpConfigured()) {
    return { sent: 0, failed: [], remaining: 0, error: "SMTP is not configured on the server." };
  }

  // "(-)" matches no ticket, so an empty skip list needs no special case.
  const notIn = (extra: string[] = []) => `(${[...skip, ...extra, "-"].join(",")})`;
  const base = (extra: string[] = []) => {
    let q = supabase
      .from(ATTENDEES_TABLE)
      .select("ticket_number, name, email, organization, designation, ticket_type, is_team, team_role", {
        count: "exact",
      })
      .eq("source", "import")
      .is("pass_emailed_at", null)
      .not("email", "is", null)
      .not("ticket_number", "in", notIn(extra));
    if (which === "team") q = q.eq("is_team", true);
    if (which === "registered") q = q.eq("is_team", false);
    return q;
  };

  // Recipients that already failed in this run are skipped so one bad
  // address can't block the queue.
  const { data, error } = await base().order("created_at").limit(BATCH_SIZE);
  if (error) return { sent: 0, failed: [], remaining: 0, error: error.message };

  let sent = 0;
  const failed: BatchResult["failed"] = [];
  for (const [i, a] of (data ?? []).entries()) {
    if (i > 0) await sleep(DELAY_BETWEEN_SENDS_MS);
    try {
      await sendPassEmail(
        a.email as string,
        a.name as string,
        a.ticket_number as string,
        {
          organization: a.organization as string | null,
          designation: a.designation as string | null,
          type: a.ticket_type as string | null,
          role: a.team_role as string | null,
        },
        cleanNote(note),
        a.is_team as boolean,
      );
      await supabase
        .from(ATTENDEES_TABLE)
        .update({ pass_emailed_at: new Date().toISOString() })
        .eq("ticket_number", a.ticket_number);
      sent++;
    } catch (e) {
      failed.push({
        ticket: a.ticket_number as string,
        name: a.name as string,
        email: a.email as string,
        error: e instanceof Error ? e.message : "Send failed",
      });
    }
  }

  const { count } = await base(failed.map((f) => f.ticket)).limit(1);

  return { sent, failed, remaining: count ?? 0 };
}
