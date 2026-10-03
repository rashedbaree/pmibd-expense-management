"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { describeError } from "@/lib/supabase/errors";
import { getCurrentProfile } from "@/lib/auth";
import { totalReceived } from "@/lib/booth";
import {
  BOOTH_NUMBER_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  ORGANIZATION_NAME_MAX_LENGTH,
  PAYMENT_REFERENCE_MAX_LENGTH,
  REMARKS_MAX_LENGTH,
} from "@/lib/constants";

function trimmed(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function optional(value: FormDataEntryValue | null, max: number): string | null {
  return trimmed(value, max) || null;
}

// Finance records money received, the same pair of roles that marks an
// expense paid. RLS enforces this too (0016_booth_registration.sql); this
// check is what turns a rejection into a readable message.
function canHandleMoney(role: string | undefined): boolean {
  return role === "finance_director" || role === "admin";
}

export async function createBooking(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const event_id = formData.get("event_id") as string;
  const package_id = (formData.get("package_id") as string) || null;
  const organization_name = trimmed(
    formData.get("organization_name"),
    ORGANIZATION_NAME_MAX_LENGTH,
  );
  const contact_name = trimmed(
    formData.get("contact_name"),
    CONTACT_NAME_MAX_LENGTH,
  );
  const contact_email = trimmed(formData.get("contact_email"), 320).toLowerCase();
  const contact_phone = optional(
    formData.get("contact_phone"),
    CONTACT_PHONE_MAX_LENGTH,
  );
  const booth_number = optional(
    formData.get("booth_number"),
    BOOTH_NUMBER_MAX_LENGTH,
  );
  const remarks = optional(formData.get("remarks"), REMARKS_MAX_LENGTH);

  const fail = (message: string) =>
    redirect(`/booths/new?error=${encodeURIComponent(message)}`);

  if (!event_id || !organization_name || !contact_name || !contact_email) {
    fail("Event, organisation, contact name and contact email are all required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    fail("Enter a valid contact email address.");
  }

  // Price falls back to the chosen package's, but is copied onto the
  // booking, so repricing a package later never rewrites what was agreed.
  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amount = Number.NaN;

  if (amountRaw) {
    amount = Number(amountRaw.replace(/,/g, ""));
  } else if (package_id) {
    const { data: pkg } = await supabase
      .from("booth_packages")
      .select("price")
      .eq("id", package_id)
      .single();
    if (pkg) amount = Number(pkg.price);
  }

  if (!Number.isFinite(amount) || amount < 0) {
    fail("Enter a booth price, or pick a package that has one.");
  }

  const { data: booking, error } = await supabase
    .from("booth_bookings")
    .insert({
      event_id,
      package_id,
      organization_name,
      contact_name,
      contact_email,
      contact_phone,
      booth_number,
      amount,
      remarks,
      registered_by: user.id,
    })
    .select("id")
    .single();

  if (error || !booking) {
    fail(describeError(error, "Failed to register the booking"));
  }

  await supabase.from("audit_log").insert({
    entity_type: "booth_booking",
    entity_id: booking!.id,
    action: "registered",
    actor_id: user.id,
    details: { event_id, organization_name, amount },
  });

  revalidatePath("/booths");
  redirect(
    `/booths?success=${encodeURIComponent(`Booth reserved for ${organization_name}.`)}`,
  );
}

export async function recordBoothPayment(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const booking_id = formData.get("booking_id") as string;
  const fail = (message: string) =>
    redirect(`/booths/${booking_id}?error=${encodeURIComponent(message)}`);

  if (!canHandleMoney(profile.role)) {
    fail("Only Finance or an administrator can record a payment.");
  }

  const date = formData.get("date") as string;
  const amount = Number(String(formData.get("amount") ?? "").replace(/,/g, ""));
  const method = formData.get("method") as string;
  const reference = optional(
    formData.get("reference"),
    PAYMENT_REFERENCE_MAX_LENGTH,
  );
  const remarks = optional(formData.get("remarks"), REMARKS_MAX_LENGTH);

  if (!date || !method) {
    fail("Date and payment method are both required.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    fail("Enter a payment amount greater than zero.");
  }

  const { data: booking } = await supabase
    .from("booth_bookings")
    .select("amount, status, payments:booth_payments(amount)")
    .eq("id", booking_id)
    .single();

  if (!booking) {
    fail("That booking no longer exists.");
  }
  if (booking!.status === "cancelled") {
    fail("This booking is cancelled, so it can't take a payment.");
  }

  const received = totalReceived(
    booking!.payments as unknown as { amount: number }[],
  );
  if (received + amount > Number(booking!.amount)) {
    fail(
      `That would take the total received past the ${Number(booking!.amount)} booked.`,
    );
  }

  const { error } = await supabase.from("booth_payments").insert({
    booking_id,
    date,
    amount,
    method,
    reference,
    remarks,
  });

  if (error) {
    fail(describeError(error, "Failed to record the payment"));
  }

  await supabase.from("audit_log").insert({
    entity_type: "booth_booking",
    entity_id: booking_id,
    action: "payment_recorded",
    actor_id: profile.id,
    details: { amount, method, reference },
  });

  revalidatePath("/booths");
  revalidatePath(`/booths/${booking_id}`);
  redirect(
    `/booths/${booking_id}?success=${encodeURIComponent("Payment recorded.")}`,
  );
}

export async function setBookingStatus(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const booking_id = formData.get("booking_id") as string;
  const status = formData.get("status") as string;
  const fail = (message: string) =>
    redirect(`/booths/${booking_id}?error=${encodeURIComponent(message)}`);

  if (status !== "confirmed" && status !== "cancelled") {
    fail("Unknown booking status.");
  }
  // Mirrors guard_booth_booking_update(): confirming is Finance's call
  // because it says the money side is agreed.
  if (status === "confirmed" && !canHandleMoney(profile.role)) {
    fail("Only Finance or an administrator can confirm a booking.");
  }

  const { error } = await supabase
    .from("booth_bookings")
    .update({ status })
    .eq("id", booking_id);

  if (error) {
    fail(describeError(error, `Failed to mark the booking ${status}`));
  }

  await supabase.from("audit_log").insert({
    entity_type: "booth_booking",
    entity_id: booking_id,
    action: status,
    actor_id: profile.id,
    details: {},
  });

  revalidatePath("/booths");
  revalidatePath(`/booths/${booking_id}`);
  redirect(
    `/booths/${booking_id}?success=${encodeURIComponent(
      status === "confirmed" ? "Booking confirmed." : "Booking cancelled.",
    )}`,
  );
}
