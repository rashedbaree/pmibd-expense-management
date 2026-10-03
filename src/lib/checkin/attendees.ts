import * as XLSX from "xlsx";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const ATTENDEES_TABLE = "checkin_attendees";
export const SCAN_LOG_TABLE = "checkin_scan_log";

export interface Attendee {
  id: string;
  ticket_number: string;
  confirmation: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  designation: string | null;
  ticket_type: string | null;
  source: "import" | "walkin";
  is_team: boolean;
  team_role: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  bag_given_at: string | null;
  bag_given_by: string | null;
  pass_emailed_at: string | null;
  created_at: string;
}

// Fields safe/useful to show on a scan result or search row.
export const PUBLIC_COLUMNS =
  "id, ticket_number, name, organization, designation, ticket_type, email, phone, source, checked_in_at, checked_in_by, bag_given_at, bag_given_by";

export type PublicAttendee = Pick<
  Attendee,
  | "id"
  | "ticket_number"
  | "name"
  | "organization"
  | "designation"
  | "ticket_type"
  | "email"
  | "phone"
  | "source"
  | "checked_in_at"
  | "checked_in_by"
  | "bag_given_at"
  | "bag_given_by"
>;

/**
 * Every row, in pages. Supabase caps a single response at 1,000 rows by
 * default, which would silently truncate a bigger event's list - stats,
 * the export, the backup list and the import's "missing from this file"
 * check all need the whole table.
 */
export async function fetchAllAttendees<T>(
  sb: SupabaseClient,
  columns: string,
  orderBy = "name",
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(ATTENDEES_TABLE)
      .select(columns)
      .order(orderBy)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

const TYPE_LABELS: Record<string, string> = {
  Single: "Single",
  PmiMember: "PMI Member",
  Deligate: "Delegate", // sic - the registration system spells it this way
  Group: "Group",
};

export function ticketTypeLabel(type: string | null | undefined) {
  if (!type) return "";
  return TYPE_LABELS[type] ?? type;
}

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** "8801916666923", "+880+8801916666923" -> digits only, prefix de-duplicated. */
export function normalizePhone(v: unknown) {
  let digits = String(v ?? "").replace(/\D/g, "");
  if (digits.startsWith("880880")) digits = digits.slice(3);
  return digits;
}

export interface ImportRow {
  ticket_number: string;
  confirmation: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  designation: string | null;
  ticket_type: string | null;
  source: "import";
  updated_at: string;
}

export interface ParsedRegistrations {
  totalRows: number;
  skippedNotPaid: number;
  skippedNoTicket: number;
  rows: ImportRow[];
}

/** Parses the registration-system export; keeps only Status = "Paid". */
export function parseRegistrations(buffer: ArrayBuffer): ParsedRegistrations {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const required = ["Ticket Number", "Name", "Status"];
  const headers = raw.length ? Object.keys(raw[0]) : [];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new Error(
      `This doesn't look like the registration export - missing column(s): ${missing.join(", ")}.`,
    );
  }

  const now = new Date().toISOString();
  const byTicket = new Map<string, ImportRow>();
  let skippedNotPaid = 0;
  let skippedNoTicket = 0;

  for (const r of raw) {
    if (clean(r["Status"]).toLowerCase() !== "paid") {
      skippedNotPaid++;
      continue;
    }
    const ticket = clean(r["Ticket Number"]).toUpperCase();
    if (!ticket) {
      skippedNoTicket++;
      continue;
    }
    byTicket.set(ticket, {
      ticket_number: ticket,
      confirmation: clean(r["Confirmation"]) || null,
      name: clean(r["Name"]),
      email: clean(r["Email"]).toLowerCase() || null,
      phone: normalizePhone(r["Phone"]) || null,
      organization: clean(r["Organization Name"]) || null,
      designation: clean(r["Designation"]) || null,
      ticket_type: clean(r["Ticket Type"]) || null,
      source: "import",
      updated_at: now,
    });
  }

  return {
    totalRows: raw.length,
    skippedNotPaid,
    skippedNoTicket,
    rows: [...byTicket.values()],
  };
}

const DHAKA = "Asia/Dhaka";

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: DHAKA,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: DHAKA,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
