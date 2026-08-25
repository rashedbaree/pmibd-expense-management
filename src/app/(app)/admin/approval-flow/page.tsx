import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import {
  addApprovalStep,
  moveApprovalStep,
  removeApprovalStep,
} from "../actions";
import type { UserRole } from "@/lib/types";

const SELECTABLE_ROLES: UserRole[] = [
  "portfolio_director",
  "finance_director",
  "president",
];

const ROLE_LABELS: Record<UserRole, string> = {
  submitter: "Submitter",
  portfolio_director: "Portfolio Director",
  finance_director: "Finance Director",
  president: "President",
  admin: "Admin",
};

export default async function ApprovalFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Approval Flow
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: steps } = await supabase
    .from("approval_chain_steps")
    .select("id, step_order, role")
    .order("step_order", { ascending: true });

  const chain = steps ?? [];
  const availableRoles = SELECTABLE_ROLES.filter(
    (r) => !chain.some((s) => s.role === r),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Approval Flow
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Every submitted expense routes through these roles in order. A
        submitter who is themselves the first role in the chain skips
        approving their own expense; it starts with the next role instead.
        The last role in the chain gives the final approval.
      </p>

      {error && (
        <p className="mt-4 max-w-2xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {chain.map((step, idx) => (
          <div
            key={step.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {idx + 1}
            </span>
            <span className="min-w-48 font-medium text-zinc-950 dark:text-zinc-50">
              {ROLE_LABELS[step.role as UserRole]}
            </span>

            <form action={moveApprovalStep}>
              <input type="hidden" name="id" value={step.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={idx === 0}
                className="rounded-md border border-zinc-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
              >
                Move up
              </button>
            </form>
            <form action={moveApprovalStep}>
              <input type="hidden" name="id" value={step.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={idx === chain.length - 1}
                className="rounded-md border border-zinc-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700"
              >
                Move down
              </button>
            </form>
            <form action={removeApprovalStep}>
              <input type="hidden" name="id" value={step.id} />
              <button
                type="submit"
                disabled={chain.length <= 1}
                className="rounded-md border border-red-300 px-2 py-1 text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-400"
              >
                Remove
              </button>
            </form>
          </div>
        ))}
        {chain.length === 0 && (
          <p className="text-sm text-zinc-500">
            No approval steps configured — expenses have nowhere to route.
            Add at least one below.
          </p>
        )}
      </div>

      {availableRoles.length > 0 && (
        <form
          action={addApprovalStep}
          className="mt-6 flex flex-wrap items-end gap-3 text-sm"
        >
          <label className="flex flex-col gap-1">
            Add step
            <select
              name="role"
              required
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand/90"
          >
            Add to end of chain
          </button>
        </form>
      )}
    </div>
  );
}
