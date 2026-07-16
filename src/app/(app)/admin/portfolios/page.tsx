import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { addPortfolio, deletePortfolio } from "../actions";
import type { Portfolio } from "@/lib/types";

export default async function AdminPortfoliosPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Portfolios
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, name")
    .order("name");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Portfolios
      </h1>

      <form action={addPortfolio} className="mt-4 flex max-w-md gap-2">
        <input
          name="name"
          required
          placeholder="New portfolio name"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90">
          Add
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {((portfolios ?? []) as Portfolio[]).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            {p.name}
            <form action={deletePortfolio}>
              <input type="hidden" name="id" value={p.id} />
              <button className="text-red-600 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {(portfolios ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">No portfolios yet.</p>
        )}
      </div>
    </div>
  );
}
