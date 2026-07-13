import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { addApprovalMatrixRow, deleteApprovalMatrixRow } from "../actions";
import type { ApprovalMatrixRow, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["portfolio_director", "finance_director", "president"];

export default async function AdminApprovalMatrixPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Approval Matrix
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("approval_matrix")
    .select("id, min_amount, max_amount, required_role")
    .order("min_amount");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Approval Matrix
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Determines which role must give final approval based on expense
        amount. The chain always runs Portfolio Director → Finance Director →
        President, stopping at the required role for that amount tier.
      </p>

      <form
        action={addApprovalMatrixRow}
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
      >
        <label className="flex flex-col gap-1">
          Min amount
          <input
            name="min_amount"
            type="number"
            step="0.01"
            required
            className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          Max amount (blank = no limit)
          <input
            name="max_amount"
            type="number"
            step="0.01"
            className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          Required role
          <select
            name="required_role"
            defaultValue={ROLES[0]}
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-md bg-zinc-950 px-3 py-1.5 font-medium text-white dark:bg-zinc-50 dark:text-zinc-950">
          Add tier
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {((rows ?? []) as ApprovalMatrixRow[]).map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {Number(r.min_amount).toLocaleString()} –{" "}
              {r.max_amount ? Number(r.max_amount).toLocaleString() : "∞"} BDT
              → final approver: <strong>{r.required_role}</strong>
            </span>
            <form action={deleteApprovalMatrixRow}>
              <input type="hidden" name="id" value={r.id} />
              <button className="text-red-600 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {(rows ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">No tiers configured yet.</p>
        )}
      </div>
    </div>
  );
}
