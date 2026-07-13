import type { ExpenseStatus } from "@/lib/types";

const STYLES: Record<ExpenseStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  pending_approval:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  returned:
    "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  approved:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  paid: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
};

const LABELS: Record<ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_approval: "Pending Approval",
  returned: "Returned",
  rejected: "Rejected",
  approved: "Approved",
  paid: "Paid",
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
