import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { addUser, updateUser } from "../actions";
import type { AppUser, Portfolio, UserRole } from "@/lib/types";

const ROLES: UserRole[] = [
  "submitter",
  "portfolio_director",
  "finance_director",
  "president",
  "admin",
];

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Users
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: users }, { data: portfolios }] = await Promise.all([
    supabase.from("users").select("*").order("name"),
    supabase.from("portfolios").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Users
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        New logins are created in the Supabase Dashboard (Authentication →
        Users). Once created, add their name/email/role here so they can be
        routed through approvals.
      </p>

      <form
        action={addUser}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
      >
        <label className="flex flex-col gap-1">
          Auth User UID
          <input
            name="id"
            required
            placeholder="from Supabase Authentication → Users"
            className="w-72 rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          Name
          <input
            name="name"
            required
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          Role
          <select
            name="role"
            required
            defaultValue=""
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Select role
            </option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Portfolio
          <select
            name="portfolio_id"
            defaultValue=""
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">None</option>
            {((portfolios ?? []) as Portfolio[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand/90">
          Add
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3">
        {((users ?? []) as AppUser[]).map((u) => (
          <form
            key={u.id}
            action={updateUser}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
          >
            <input type="hidden" name="id" value={u.id} />
            <div className="min-w-48">
              <p className="font-medium text-zinc-950 dark:text-zinc-50">
                {u.name}
              </p>
              <p className="text-zinc-500">{u.email}</p>
            </div>

            <label className="flex flex-col gap-1">
              Role
              <select
                name="role"
                defaultValue={u.role}
                className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              Portfolio
              <select
                name="portfolio_id"
                defaultValue={u.portfolio_id ?? ""}
                className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">None</option>
                {((portfolios ?? []) as Portfolio[]).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={u.is_active}
              />
              Active
            </label>

            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Save
            </button>
          </form>
        ))}
        {(users ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">No users yet.</p>
        )}
      </div>
    </div>
  );
}
