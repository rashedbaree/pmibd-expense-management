import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  BoothPaymentBadge,
  BoothStatusBadge,
} from "@/components/BoothStatusBadge";
import {
  countsAsRevenue,
  formatAmount,
  outstanding,
  paymentState,
  totalReceived,
  type BoothPaymentState,
} from "@/lib/booth";
import type { BoothBookingStatus } from "@/lib/types";

const STATUS_OPTIONS: BoothBookingStatus[] = [
  "reserved",
  "confirmed",
  "cancelled",
];

const PAYMENT_OPTIONS: { value: BoothPaymentState; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Part Paid" },
  { value: "paid", label: "Paid" },
];

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type BookingRow = {
  id: string;
  organization_name: string;
  contact_name: string;
  booth_number: string | null;
  amount: number;
  status: BoothBookingStatus;
  event: { name: string; date: string } | null;
  package: { name: string } | null;
  payments: { amount: number }[] | null;
};

type SearchParams = {
  event_id?: string;
  status?: string;
  payment?: string;
  q?: string;
  success?: string;
  error?: string;
};

export default async function BoothsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  let query = supabase
    .from("booth_bookings")
    .select(
      `id, organization_name, contact_name, booth_number, amount, status,
       event:events(name, date),
       package:booth_packages(name),
       payments:booth_payments(amount)`,
    )
    .order("created_at", { ascending: false });

  if (filters.event_id) query = query.eq("event_id", filters.event_id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) query = query.ilike("organization_name", `%${filters.q}%`);

  const [{ data: rawBookings, error }, { data: events }] = await Promise.all([
    query,
    supabase
      .from("events")
      .select("id, name, date")
      .order("date", { ascending: false }),
  ]);

  const bookings = ((rawBookings ?? []) as unknown as BookingRow[]).map((b) => {
    const received = totalReceived(b.payments);
    const live = countsAsRevenue(b.status);
    return {
      ...b,
      received,
      live,
      // A cancelled booth is owed nothing, so it carries no balance and no
      // payment state - showing "Unpaid · 45,000 outstanding" against one
      // reads as a debt that nobody is chasing.
      due: live ? outstanding(b.amount, received) : 0,
      state: live ? paymentState(b.amount, received) : null,
    };
  });

  // Payment state is summed from the payments rather than stored, so it
  // can't be filtered in the query.
  const rows = filters.payment
    ? bookings.filter((b) => b.state === filters.payment)
    : bookings;

  // A cancelled booking is neither revenue nor a receivable.
  const live = rows.filter((b) => b.live);
  const totalBooked = live.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalReceivedAll = live.reduce((sum, b) => sum + b.received, 0);
  const totalDue = live.reduce((sum, b) => sum + b.due, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Booth Registrations
        </h1>
        <Link
          href="/booths/new"
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
        >
          Register Booth
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Event
          <select
            name="event_id"
            defaultValue={filters.event_id ?? ""}
            className={inputClass}
          >
            <option value="">All</option>
            {(events ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.date}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className={inputClass}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Payment
          <select
            name="payment"
            defaultValue={filters.payment ?? ""}
            className={inputClass}
          >
            <option value="">All</option>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Organisation
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search"
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
        >
          Filter
        </button>
        <Link href="/booths" className="px-3 py-1.5 text-zinc-500 hover:underline">
          Clear
        </Link>
      </form>

      {filters.success && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          {filters.success}
        </p>
      )}

      {(filters.error || error) && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {filters.error ?? error?.message}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Booked", value: totalBooked },
          { label: "Received", value: totalReceivedAll },
          { label: "Outstanding", value: totalDue },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            <p className="text-xs uppercase text-zinc-500">{card.label}</p>
            <p className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              {formatAmount(card.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Organisation</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2">Booth</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2">
                  <Link
                    href={`/booths/${b.id}`}
                    className="text-brand hover:underline"
                  >
                    {b.organization_name}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {b.event?.name ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {b.package?.name ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {b.booth_number ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{b.contact_name}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatAmount(b.amount)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatAmount(b.received)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {b.live ? formatAmount(b.due) : "—"}
                </td>
                <td className="px-3 py-2">
                  {b.state ? <BoothPaymentBadge state={b.state} /> : "—"}
                </td>
                <td className="px-3 py-2">
                  <BoothStatusBadge status={b.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-zinc-500">
                  No booth registrations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
