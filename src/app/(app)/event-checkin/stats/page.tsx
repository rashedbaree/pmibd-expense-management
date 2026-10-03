"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/lib/checkin/attendees";

interface Stats {
  total: number;
  checkedIn: number;
  bagGiven: number;
  walkIns: number;
  byType: { type: string; total: number; checkedIn: number }[];
  recent: { name: string; organization: string | null; at: string; by: string | null }[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/event-checkin/api/stats", { cache: "no-store" });
        const isJson = r.headers.get("content-type")?.includes("application/json");
        if (!alive) return;
        if (r.redirected || !isJson) {
          setError("Signed out - reload the page and sign in again.");
          return;
        }
        const json = await r.json();
        if (r.ok) {
          setStats(json);
          setError(null);
        } else setError(json.error ?? "Could not load");
      } catch {
        if (alive) setError("No connection - retrying…");
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!stats) {
    return <p className="text-zinc-500">{error ?? "Loading…"}</p>;
  }

  const pct = stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {error && <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>}

      <section className="rounded-2xl border border-zinc-200 p-6 text-center dark:border-zinc-800">
        <div className="text-7xl font-black text-brand dark:text-zinc-50">
          {stats.checkedIn}
          <span className="text-3xl font-semibold text-zinc-400"> / {stats.total}</span>
        </div>
        <div className="mt-1 text-zinc-500">checked in · {pct}%</div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Remaining" value={stats.total - stats.checkedIn} />
        <Stat label="Bags given" value={stats.bagGiven} />
        <Stat label="Walk-ins" value={stats.walkIns} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          By ticket type
        </h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {stats.byType.map((t) => (
            <li key={t.type} className="flex justify-between px-4 py-2 text-sm">
              <span>{t.type}</span>
              <span className="font-semibold">
                {t.checkedIn} / {t.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Latest check-ins
        </h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {stats.recent.length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-500">Nobody yet.</li>
          )}
          {stats.recent.map((r, i) => (
            <li key={i} className="flex justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 truncate">
                <b>{r.name}</b>
                {r.organization ? ` · ${r.organization}` : ""}
              </span>
              <span className="shrink-0 text-zinc-500">
                {formatTime(r.at)}
                {r.by ? ` · ${r.by}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 py-4 dark:border-zinc-800">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs tracking-wide text-zinc-500 uppercase">{label}</div>
    </div>
  );
}
