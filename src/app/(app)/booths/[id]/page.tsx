import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  BoothPaymentBadge,
  BoothStatusBadge,
} from "@/components/BoothStatusBadge";
import {
  formatAmount,
  outstanding,
  paymentState,
  totalReceived,
} from "@/lib/booth";
import {
  PAYMENT_REFERENCE_MAX_LENGTH,
  REMARKS_MAX_LENGTH,
} from "@/lib/constants";
import type { BoothBookingStatus, PaymentMethod } from "@/lib/types";
import { recordBoothPayment, setBookingStatus } from "../actions";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cheque: "Cheque",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
};

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type PaymentRow = {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  remarks: string | null;
};

type BookingDetail = {
  id: string;
  organization_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  booth_number: string | null;
  amount: number;
  status: BoothBookingStatus;
  remarks: string | null;
  registered_by: string;
  event: { name: string; date: string } | null;
  package: { name: string } | null;
  registrar: { name: string } | null;
  payments: PaymentRow[] | null;
};

export default async function BoothBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("booth_bookings")
    .select(
      `id, organization_name, contact_name, contact_email, contact_phone,
       booth_number, amount, status, remarks, registered_by,
       event:events(name, date),
       package:booth_packages(name),
       registrar:users!booth_bookings_registered_by_fkey(name),
       payments:booth_payments(id, date, amount, method, reference, remarks)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const booking = data as unknown as BookingDetail;
  const payments = [...(booking.payments ?? [])].sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );
  const received = totalReceived(payments);
  const due = outstanding(booking.amount, received);
  const state = paymentState(booking.amount, received);

  const isFinance =
    profile.role === "finance_director" || profile.role === "admin";
  const isCancelled = booking.status === "cancelled";
  const canConfirm = isFinance && booking.status === "reserved";
  const canCancel =
    !isCancelled &&
    (isFinance || (booking.registered_by === profile.id && booking.status === "reserved"));
  const canRecordPayment = isFinance && !isCancelled && due > 0;

  const facts: { label: string; value: string }[] = [
    { label: "Event", value: booking.event?.name ?? "—" },
    { label: "Event Date", value: booking.event?.date ?? "—" },
    { label: "Package", value: booking.package?.name ?? "Priced manually" },
    { label: "Booth Number", value: booking.booth_number ?? "Not assigned" },
    { label: "Contact", value: booking.contact_name },
    { label: "Email", value: booking.contact_email },
    { label: "Phone", value: booking.contact_phone ?? "—" },
    { label: "Registered By", value: booking.registrar?.name ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/booths" className="text-sm text-brand hover:underline">
          ← Booth Registrations
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {booking.organization_name}
          </h1>
          <BoothStatusBadge status={booking.status} />
          <BoothPaymentBadge state={state} />
        </div>
      </div>

      {success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Booked", value: booking.amount },
          { label: "Received", value: received },
          { label: "Outstanding", value: due },
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

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">Details</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex justify-between gap-4">
              <dt className="text-zinc-500">{f.label}</dt>
              <dd className="text-right text-zinc-950 dark:text-zinc-50">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
        {booking.remarks && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {booking.remarks}
          </p>
        )}

        {(canConfirm || canCancel) && (
          <div className="mt-4 flex flex-wrap gap-3">
            {canConfirm && (
              <form action={setBookingStatus}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <input type="hidden" name="status" value="confirmed" />
                <ConfirmSubmitButton
                  confirmMessage={`Confirm the booth for ${booking.organization_name}?`}
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
                >
                  Confirm Booking
                </ConfirmSubmitButton>
              </form>
            )}
            {canCancel && (
              <form action={setBookingStatus}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <input type="hidden" name="status" value="cancelled" />
                <ConfirmSubmitButton
                  destructive
                  confirmMessage={`Cancel the booth for ${booking.organization_name}? Its booth number is released for someone else.`}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                >
                  Cancel Booking
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">Payments</h2>

        {canRecordPayment ? (
          <form
            action={recordBoothPayment}
            className="mt-3 flex flex-wrap items-end gap-3 text-sm"
          >
            <input type="hidden" name="booking_id" value={booking.id} />
            <label className="flex flex-col gap-1">
              Date
              <input type="date" name="date" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1">
              Amount
              <input
                type="number"
                name="amount"
                min="0.01"
                max={due}
                step="0.01"
                required
                defaultValue={due}
                className={`${inputClass} w-32`}
              />
            </label>
            <label className="flex flex-col gap-1">
              Method
              <select name="method" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Select
                </option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Reference
              <input
                name="reference"
                maxLength={PAYMENT_REFERENCE_MAX_LENGTH}
                placeholder="Cheque or transaction no."
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              Remarks
              <input
                name="remarks"
                maxLength={REMARKS_MAX_LENGTH}
                className={inputClass}
              />
            </label>
            <ConfirmSubmitButton
              confirmMessage={`Record this payment against ${booking.organization_name}'s booth?`}
              className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand/90"
            >
              Record Payment
            </ConfirmSubmitButton>
          </form>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            {isCancelled
              ? "This booking is cancelled, so it can't take further payments."
              : due === 0
                ? "This booth is paid in full."
                : "Only Finance or an administrator can record a payment."}
          </p>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{p.date}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatAmount(p.amount)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {METHOD_LABELS[p.method]}
                  </td>
                  <td className="px-3 py-2">{p.reference ?? "—"}</td>
                  <td className="px-3 py-2">{p.remarks ?? "—"}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                    Nothing received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
