import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { addEvent, deleteEvent } from "../actions";
import type { EventRow, Portfolio } from "@/lib/types";

export default async function AdminEventsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Events
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: events }, { data: portfolios }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, date, portfolio_id")
      .order("date", { ascending: false }),
    supabase.from("portfolios").select("id, name").order("name"),
  ]);

  const portfolioMap = new Map(
    ((portfolios ?? []) as Portfolio[]).map((p) => [p.id, p.name]),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Events
      </h1>

      <form action={addEvent} className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Name
          <input
            name="name"
            required
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          Date
          <input
            name="date"
            type="date"
            required
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          Portfolio
          <select
            name="portfolio_id"
            required
            defaultValue=""
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Select portfolio
            </option>
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

      <div className="mt-4 flex flex-col gap-2">
        {((events ?? []) as EventRow[]).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {e.name} · {e.date} · {portfolioMap.get(e.portfolio_id)}
            </span>
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={e.id} />
              <button className="text-red-600 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {(events ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">No events yet.</p>
        )}
      </div>
    </div>
  );
}
