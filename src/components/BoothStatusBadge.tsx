import type { BoothBookingStatus } from "@/lib/types";
import type { BoothPaymentState } from "@/lib/booth";

const BOOKING_STYLES: Record<BoothBookingStatus, string> = {
  reserved: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  confirmed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  cancelled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const BOOKING_LABELS: Record<BoothBookingStatus, string> = {
  reserved: "Reserved",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const PAYMENT_STYLES: Record<BoothPaymentState, string> = {
  unpaid: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  partial: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  paid: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
};

const PAYMENT_LABELS: Record<BoothPaymentState, string> = {
  unpaid: "Unpaid",
  partial: "Part Paid",
  paid: "Paid",
};

const base = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium";

export function BoothStatusBadge({ status }: { status: BoothBookingStatus }) {
  return (
    <span className={`${base} ${BOOKING_STYLES[status]}`}>
      {BOOKING_LABELS[status]}
    </span>
  );
}

export function BoothPaymentBadge({ state }: { state: BoothPaymentState }) {
  return (
    <span className={`${base} ${PAYMENT_STYLES[state]}`}>
      {PAYMENT_LABELS[state]}
    </span>
  );
}
