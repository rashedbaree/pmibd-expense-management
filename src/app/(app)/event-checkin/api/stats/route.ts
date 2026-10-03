import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminForRoute } from "@/lib/checkin/access";
import { fetchAllAttendees, ticketTypeLabel } from "@/lib/checkin/attendees";

interface Row {
  name: string;
  organization: string | null;
  ticket_type: string | null;
  source: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  bag_given_at: string | null;
}

export async function GET() {
  const auth = await adminForRoute();
  if ("response" in auth) return auth.response;

  let rows: Row[];
  try {
    const supabase = await createClient();
    rows = await fetchAllAttendees<Row>(
      supabase,
      "name, organization, ticket_type, source, checked_in_at, checked_in_by, bag_given_at",
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load" },
      { status: 500 },
    );
  }

  const byType = new Map<string, { total: number; checkedIn: number }>();
  for (const r of rows) {
    const key =
      r.source === "walkin"
        ? r.ticket_type || "Walk-in"
        : ticketTypeLabel(r.ticket_type) || "Other";
    const t = byType.get(key) ?? { total: 0, checkedIn: 0 };
    t.total++;
    if (r.checked_in_at) t.checkedIn++;
    byType.set(key, t);
  }

  const recent = rows
    .filter((r) => r.checked_in_at)
    .sort((a, b) => b.checked_in_at!.localeCompare(a.checked_in_at!))
    .slice(0, 12)
    .map((r) => ({
      name: r.name,
      organization: r.organization,
      at: r.checked_in_at,
      by: r.checked_in_by,
    }));

  return NextResponse.json({
    total: rows.length,
    checkedIn: rows.filter((r) => r.checked_in_at).length,
    bagGiven: rows.filter((r) => r.bag_given_at).length,
    walkIns: rows.filter((r) => r.source === "walkin").length,
    byType: [...byType.entries()].map(([type, v]) => ({ type, ...v })),
    recent,
  });
}
