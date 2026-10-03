import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminForRoute } from "@/lib/checkin/access";
import { ATTENDEES_TABLE, PUBLIC_COLUMNS } from "@/lib/checkin/attendees";

export async function GET(req: NextRequest) {
  const auth = await adminForRoute();
  if ("response" in auth) return auth.response;

  // Strip characters that have meaning inside a PostgREST .or() filter.
  const q = (req.nextUrl.searchParams.get("q") ?? "")
    .replace(/[,()*%\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const digits = q.replace(/\D/g, "");
  const filters = [
    `name.ilike.%${q}%`,
    `email.ilike.%${q}%`,
    `ticket_number.ilike.%${q}%`,
    `organization.ilike.%${q}%`,
  ];
  if (digits.length >= 4) filters.push(`phone.ilike.%${digits}%`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(ATTENDEES_TABLE)
    .select(PUBLIC_COLUMNS)
    .or(filters.join(","))
    .order("name")
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data });
}
