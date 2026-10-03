import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { createBooking } from "../actions";
import NewBookingForm from "./form";
import type { BoothPackage, EventRow } from "@/lib/types";

export default async function NewBoothBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: events }, { data: packages }, { data: booked }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, name, date, portfolio_id")
        .order("date", { ascending: false }),
      supabase
        .from("booth_packages")
        .select("id, event_id, name, price, total_booths")
        .order("price"),
      // Cancelled bookings release their slot, so they don't count against
      // a package's capacity.
      supabase
        .from("booth_bookings")
        .select("package_id")
        .neq("status", "cancelled")
        .not("package_id", "is", null),
    ]);

  const bookedPerPackage: Record<string, number> = {};
  for (const row of booked ?? []) {
    const id = row.package_id as string;
    bookedPerPackage[id] = (bookedPerPackage[id] ?? 0) + 1;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Register Booth
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Reserves a booth for an exhibitor. Finance confirms it and records
        payments against it afterwards.
      </p>

      {error && (
        <p className="mt-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {(events ?? []).length === 0 ? (
        <p className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          There are no events yet. An administrator adds one under Admin →
          Events before booths can be booked.
        </p>
      ) : (
        <NewBookingForm
          action={createBooking}
          events={(events ?? []) as EventRow[]}
          packages={(packages ?? []) as BoothPackage[]}
          bookedPerPackage={bookedPerPackage}
        />
      )}
    </div>
  );
}
