import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { updatePortfolioVisibility, updateRoleVisibility } from "../actions";
import type { Portfolio, RoleFullVisibility, UserRole } from "@/lib/types";

const ROLES: UserRole[] = [
  "submitter",
  "portfolio_director",
  "finance_director",
  "president",
  "admin",
];

export default async function AdminVisibilityPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Expense Visibility
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: roleRows }, { data: portfolios }] = await Promise.all([
    supabase.from("role_full_visibility").select("role, full_visibility"),
    supabase.from("portfolios").select("id, name, full_visibility").order("name"),
  ]);

  const roleVisibility = new Map(
    ((roleRows ?? []) as RoleFullVisibility[]).map((r) => [r.role, r.full_visibility]),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Expense Visibility
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        By default, everyone only sees expenses in their own portfolio on the
        Dashboard, Reports, and Expenses pages. Turn on "Full visibility"
        below for a role or a portfolio to let anyone who matches see every
        portfolio's expenses instead. Admins always see everything.
      </p>

      <div className="mt-6">
        <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
          By role
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {ROLES.map((role) => {
            const isAdmin = role === "admin";
            const checked = isAdmin || roleVisibility.get(role) === true;
            return (
              <form
                key={role}
                action={updateRoleVisibility}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
              >
                <input type="hidden" name="role" value={role} />
                <span className="min-w-48 font-medium text-zinc-950 dark:text-zinc-50">
                  {role}
                </span>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="full_visibility"
                    defaultChecked={checked}
                    disabled={isAdmin}
                  />
                  Full visibility
                </label>
                <button
                  type="submit"
                  disabled={isAdmin}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Save
                </button>
              </form>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
          By portfolio
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {((portfolios ?? []) as Portfolio[]).map((p) => (
            <form
              key={p.id}
              action={updatePortfolioVisibility}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
            >
              <input type="hidden" name="id" value={p.id} />
              <span className="min-w-48 font-medium text-zinc-950 dark:text-zinc-50">
                {p.name}
              </span>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="full_visibility"
                  defaultChecked={p.full_visibility}
                />
                Full visibility
              </label>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Save
              </button>
            </form>
          ))}
          {(portfolios ?? []).length === 0 && (
            <p className="text-sm text-zinc-500">No portfolios yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
