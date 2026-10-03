import type { BoothBookingStatus } from "@/lib/types";

// How much of a booking has been received. Never stored on the booking
// itself (see 0016_booth_registration.sql) - always summed from the
// payments so the two can't drift apart.
export type BoothPaymentState = "unpaid" | "partial" | "paid";

export function totalReceived(payments: { amount: number }[] | null): number {
  return (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}

export function outstanding(amount: number, received: number): number {
  return Math.max(Number(amount) - received, 0);
}

export function paymentState(
  amount: number,
  received: number,
): BoothPaymentState {
  if (received <= 0) return "unpaid";
  // Fully paid the moment nothing is outstanding, so an overpayment still
  // reads as paid rather than sitting at "partial" forever.
  if (received >= Number(amount)) return "paid";
  return "partial";
}

// A cancelled booking isn't revenue, so it never counts toward a total - and
// nothing is owed on it either, however little was paid before it fell through.
export function countsAsRevenue(status: BoothBookingStatus): boolean {
  return status !== "cancelled";
}

export function formatAmount(amount: number): string {
  return Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
