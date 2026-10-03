"use client";

import { useActionState } from "react";
import { addTeamMembers } from "./actions";

export default function TeamForm() {
  const [r, action, pending] = useActionState(addTeamMembers, undefined);

  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <textarea
          name="list"
          required
          rows={7}
          placeholder={
            "One person per line: Name, email, role\n\nRashed Baree, rashed@example.com, BOD\nAnnesha Ahmed, annesha@example.com, Volunteer"
          }
          className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to team"}
        </button>
      </form>

      {r?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {r.error}
        </p>
      )}
      {(r?.added !== undefined || r?.updated !== undefined) && !r.error && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Added <b>{r.added}</b> new, updated <b>{r.updated}</b> already on the team
          {!!r.merged && (
            <>
              , and matched <b>{r.merged}</b> to their existing registration (kept their real ticket)
            </>
          )}
          .
        </p>
      )}
      {!!r?.problems?.length && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">These lines were skipped:</p>
          <ul className="list-disc pl-5">
            {r.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
