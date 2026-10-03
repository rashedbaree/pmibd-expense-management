import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { adminForRoute } from "@/lib/checkin/access";
import {
  fetchAllAttendees,
  formatDateTime,
  ticketTypeLabel,
  type Attendee,
} from "@/lib/checkin/attendees";

export async function GET() {
  const auth = await adminForRoute();
  if ("response" in auth) return auth.response;

  let attendees: Attendee[];
  try {
    const supabase = await createClient();
    attendees = await fetchAllAttendees<Attendee>(supabase, "*", "name");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load" },
      { status: 500 },
    );
  }

  const rows = attendees.map((a) => ({
    "Ticket Number": a.ticket_number,
    Name: a.name,
    Organization: a.organization ?? "",
    Designation: a.designation ?? "",
    Email: a.email ?? "",
    Phone: a.phone ?? "",
    "Ticket Type": a.source === "walkin" ? a.ticket_type ?? "" : ticketTypeLabel(a.ticket_type),
    Source: a.source === "walkin" ? "Walk-in" : "Registered",
    Team: a.is_team ? a.team_role ?? "Yes" : "",
    "Pass Emailed": a.pass_emailed_at ? "Yes" : "No",
    "Pass Emailed At": formatDateTime(a.pass_emailed_at),
    "Checked In": a.checked_in_at ? "Yes" : "No",
    "Checked In At": formatDateTime(a.checked_in_at),
    "Checked In By": a.checked_in_by ?? "",
    "Bag Given": a.bag_given_at ? "Yes" : "No",
    "Bag Given At": formatDateTime(a.bag_given_at),
    "Bag Given By": a.bag_given_by ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Attendance");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="event-attendance-${stamp}.xlsx"`,
    },
  });
}
