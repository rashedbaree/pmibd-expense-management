import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { formatAmount } from "@/lib/booth";
import { addBoothPackage, deleteBoothPackage } from "../actions";
import type { EventRow } from "@/lib/types";

const inputClass =
  "rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900";

type PackageRow = {
  id: string;
  name: string;
  price: number;
  total_booths: number | null;
  event: { name: string; date: string } | null;
};

export default async function AdminBoothPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  const { error } = await searchParams;

  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Booth Packages
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: rawPackages }, { data: events }] = await Promise.all([
    supabase
      .from("booth_packages")
      .select("id, name, price, total_booths, event:events(name, date)")
      .order("price"),
    supabase
      .from("events")
      .select("id, name, date, portfolio_id")
      .order("date", { ascending: false }),
  ]);

  const packages = (rawPackages ?? []) as unknown as PackageRow[];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Booth Packages
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        The booth tiers on offer at an event. A registration picks one and
        copies its price, so repricing a package later never changes a booth
        that is already booked.
      </p>

      {error && (
        <p className="mt-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        action={addBoothPackage}
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
      >
        <label className="flex flex-col gap-1">
          Event
          <select name="event_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select event
            </option>
            {((events ?? []) as EventRow[]).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.date}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Name
          <input
            name="name"
            required
            placeholder="Gold, Standard…"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          Price
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            className={`${inputClass} w-32`}
          />
        </label>
        <label className="flex flex-col gap-1">
          Booths Available
          <input
            name="total_booths"
            type="number"
            min="1"
            step="1"
            placeholder="Optional"
            className={`${inputClass} w-32`}
          />
        </label>
        <button className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand/90">
          Add
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {packages.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {p.event?.name ?? "—"} · {p.name} · {formatAmount(p.price)}
              {p.total_booths === null ? "" : ` · ${p.total_booths} booths`}
            </span>
            <form action={deleteBoothPackage}>
              <input type="hidden" name="id" value={p.id} />
              <button className="text-red-600 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {packages.length === 0 && (
          <p className="text-sm text-zinc-500">No booth packages yet.</p>
        )}
      </div>
    </div>
  );
}
