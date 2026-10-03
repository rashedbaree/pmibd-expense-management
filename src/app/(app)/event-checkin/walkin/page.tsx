"use client";

import { useActionState } from "react";
import { createWalkIn } from "./actions";

const TYPES = ["Walk-in", "Speaker", "Guest", "Sponsor", "Volunteer", "Media", "Organiser"];

const field =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900";

export default function WalkInPage() {
  const [state, action, pending] = useActionState(createWalkIn, undefined);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Add walk-in
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          For anyone not in the registration list. They are checked in
          immediately and counted separately.
        </p>
      </div>

      {state?.created && (
        <p className="rounded-md bg-emerald-50 px-3 py-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <b>{state.created.name}</b> added and checked in. Ticket{" "}
          <span className="font-mono">{state.created.ticket}</span>.
        </p>
      )}
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </p>
      )}

      {/* key remounts the form (clearing fields) after each successful add */}
      <form key={state?.created?.ticket ?? "new"} action={action} className="space-y-3">
        <label className="block text-sm font-medium">
          Full name *
          <input name="name" required autoComplete="off" className={field} />
        </label>
        <label className="block text-sm font-medium">
          Organisation
          <input name="organization" autoComplete="off" className={field} />
        </label>
        <label className="block text-sm font-medium">
          Designation
          <input name="designation" autoComplete="off" className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Phone
            <input name="phone" inputMode="tel" autoComplete="off" className={field} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" autoComplete="off" className={field} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Type
          <select name="type" className={field} defaultValue="Walk-in">
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="bag" className="h-5 w-5" />
          Hand over the gift bag now
        </label>
        <button
          disabled={pending}
          className="w-full rounded-md bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add & check in"}
        </button>
      </form>
    </div>
  );
}
