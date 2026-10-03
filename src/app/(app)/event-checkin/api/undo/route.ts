import { NextResponse, type NextRequest } from "next/server";
import { adminForRoute } from "@/lib/checkin/access";
import { undoScan } from "@/lib/checkin/checkin";

export async function POST(req: NextRequest) {
  const auth = await adminForRoute();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const station = body?.mode === "bag" ? "bag" : "checkin";
  if (!code.trim()) {
    return NextResponse.json({ error: "Empty code." }, { status: 400 });
  }

  try {
    return NextResponse.json(await undoScan(code, station, auth.profile.name));
  } catch (e) {
    console.error("event-checkin undo failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
