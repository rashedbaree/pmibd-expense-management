"use client";

import { useActionState } from "react";
import { resetTestData } from "./actions";

export default function ResetPage() {
  const [r, action, pending] = useActionState(resetTestData, undefined);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-red-700 dark:text-red-400">
          Reset test data
        </h1>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          Use this <b>once, after the trial run and before the event</b>. It
          clears every check-in and gift-bag record, deletes walk-ins added
          during testing, and empties the scan log.
        </p>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          It does <b>not</b> touch the attendee list, the team list, or who
          has already been emailed a pass. Never use it during the event: it
          wipes <b>everyone&apos;s</b> check-in. To fix one person&apos;s mistake, use
          Undo on the scan or search screen instead.
        </p>
      </div>

      <form
        action={action}
        className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
      >
        <label className="block text-sm font-medium">
          Type <span className="font-mono">RESET</span> to confirm
          <input
            name="confirm"
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-red-300 bg-white px-3 py-3 font-mono text-zinc-950 dark:border-red-800 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <button
          disabled={pending}
          className="rounded-md bg-red-700 px-5 py-2.5 font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          {pending ? "Resetting…" : "Reset test data"}
        </button>
      </form>

      {r?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {r.error}
        </p>
      )}
      {r?.done && (
        <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Done. Cleared <b>{r.done.checkedIn}</b> check-ins, <b>{r.done.bags}</b> bag
          records, <b>{r.done.walkIns}</b> walk-ins and <b>{r.done.scans}</b> scan log entries.
        </p>
      )}
    </div>
  );
}
