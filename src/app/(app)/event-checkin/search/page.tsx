"use client";

import { useEffect, useState } from "react";
import type { ScanResult } from "@/lib/checkin/checkin";
import {
  formatTime,
  ticketTypeLabel,
  type PublicAttendee,
} from "@/lib/checkin/attendees";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Mode = "checkin" | "bag";

const API = "/event-checkin/api";
const SIGNED_OUT = "Signed out - reload the page and sign in again.";

// A session that expired mid-event is answered by the app's login redirect
// rather than JSON; treat that as "signed out", not a network problem.
async function readJson(r: Response) {
  const isJson = r.headers.get("content-type")?.includes("application/json");
  if (r.redirected || !isJson) return null;
  return r.json();
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("checkin");
  const [fetched, setFetched] = useState<PublicAttendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [undoTarget, setUndoTarget] = useState<PublicAttendee | null>(null);

  const term = q.trim();
  const results = term.length < 2 ? [] : fetched;

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const json = await readJson(r);
        if (!json) setMessage({ ok: false, text: SIGNED_OUT });
        else if (r.ok) setFetched(json.results);
        else setMessage({ ok: false, text: json.error ?? "Search failed" });
      } catch {
        // aborted by a newer keystroke, or offline - ignore
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  async function act(a: PublicAttendee) {
    setMessage(null);
    try {
      const r = await fetch(`${API}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: a.ticket_number, mode }),
      });
      const json = await readJson(r);
      if (!json) {
        setMessage({ ok: false, text: SIGNED_OUT });
        return;
      }
      if (!r.ok) {
        setMessage({ ok: false, text: json.error ?? "Server error" });
        return;
      }
      const res = json as ScanResult;
      if (res.result === "ok") {
        setFetched((list) => list.map((x) => (x.id === a.id ? res.attendee : x)));
        setMessage({
          ok: true,
          text: `${res.attendee.name}: ${mode === "bag" ? "bag given" : "checked in"}.${res.note ? " " + res.note : ""}`,
        });
      } else if (res.result === "already") {
        setFetched((list) => list.map((x) => (x.id === a.id ? res.attendee : x)));
        setMessage({
          ok: false,
          text: `${res.attendee.name} was already done at ${formatTime(res.at)}${res.by ? ` by ${res.by}` : ""}.`,
        });
      }
    } catch {
      setMessage({ ok: false, text: "No connection. Try again." });
    }
  }

  async function undo(a: PublicAttendee) {
    setMessage(null);
    try {
      const r = await fetch(`${API}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: a.ticket_number, mode }),
      });
      const json = await readJson(r);
      if (!json) {
        setMessage({ ok: false, text: SIGNED_OUT });
        return;
      }
      if (!r.ok) {
        setMessage({ ok: false, text: json.error ?? "Server error" });
        return;
      }
      if (json.result === "undone") {
        setFetched((list) => list.map((x) => (x.id === a.id ? json.attendee : x)));
        setMessage({ ok: true, text: `Undone for ${a.name}.` });
      }
    } catch {
      setMessage({ ok: false, text: "No connection. Try again." });
    }
  }

  const modeBtn = (m: Mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
        mode === m
          ? "bg-brand text-white"
          : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex gap-2">
        {modeBtn("checkin", "Check-in")}
        {modeBtn("bag", "Gift bag")}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        placeholder="Name, phone, email, organisation or ticket no."
        className="w-full rounded-md border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />

      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            message.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {message.text}
        </p>
      )}

      {term.length >= 2 && !loading && results.length === 0 && (
        <p className="text-sm text-zinc-500">
          No match. Try fewer letters, or add them as a walk-in.
        </p>
      )}

      <ul className="space-y-2">
        {results.map((a) => {
          const done = mode === "bag" ? a.bag_given_at : a.checked_in_at;
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-zinc-950 dark:text-zinc-50">
                  {a.name}
                </div>
                <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {[a.organization, a.source === "walkin" ? a.ticket_type : ticketTypeLabel(a.ticket_type)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono dark:bg-zinc-800">
                    {a.ticket_number}
                  </span>
                  {a.checked_in_at && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      In {formatTime(a.checked_in_at)}
                    </span>
                  )}
                  {a.bag_given_at && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Bag {formatTime(a.bag_given_at)}
                    </span>
                  )}
                </div>
              </div>
              {done ? (
                <button
                  onClick={() => setUndoTarget(a)}
                  className="shrink-0 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-800 dark:text-red-400"
                >
                  Undo
                </button>
              ) : (
                <button
                  onClick={() => act(a)}
                  className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
                >
                  {mode === "bag" ? "Give bag" : "Check in"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {undoTarget && (
        <ConfirmDialog
          title="Undo this?"
          message={`${mode === "bag" ? "Take back the gift bag for" : "Undo the check-in for"} ${undoTarget.name}?`}
          confirmLabel="Yes, undo"
          cancelLabel="No, keep it"
          destructive
          onCancel={() => setUndoTarget(null)}
          onConfirm={() => {
            const target = undoTarget;
            setUndoTarget(null);
            undo(target);
          }}
        />
      )}
    </div>
  );
}
