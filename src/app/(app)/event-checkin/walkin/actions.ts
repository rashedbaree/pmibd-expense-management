"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/checkin/access";
import { ATTENDEES_TABLE } from "@/lib/checkin/attendees";

export interface WalkInState {
  error?: string;
  created?: { name: string; ticket: string };
}

// No 0/O/1/I so a hand-written ticket number can't be misread.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomTicket() {
  let s = "WI-";
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export async function createWalkIn(
  _prev: WalkInState | undefined,
  formData: FormData,
): Promise<WalkInState> {
  const admin = await requireAdmin();

  const text = (k: string, max = 120) =>
    String(formData.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const name = text("name");
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const giveBag = formData.get("bag") === "on";

  for (let attempt = 0; attempt < 5; attempt++) {
    const ticket = randomTicket();
    const { error } = await supabase.from(ATTENDEES_TABLE).insert({
      ticket_number: ticket,
      name,
      email: text("email").toLowerCase() || null,
      phone: text("phone").replace(/\D/g, "") || null,
      organization: text("organization") || null,
      designation: text("designation") || null,
      ticket_type: text("type", 30) || "Walk-in",
      source: "walkin",
      checked_in_at: now,
      checked_in_by: admin.name,
      bag_given_at: giveBag ? now : null,
      bag_given_by: giveBag ? admin.name : null,
    });
    if (!error) return { created: { name, ticket } };
    if (error.code !== "23505") return { error: error.message };
  }
  return { error: "Could not generate a ticket number. Try again." };
}
