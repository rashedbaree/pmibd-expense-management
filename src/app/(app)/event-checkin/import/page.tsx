"use client";

import { useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { importRegistrations, removeMissing } from "./actions";

export default function ImportPage() {
  const [r, action, pending] = useActionState(importRegistrations, undefined);
  const [removal, setRemoval] = useState<{ msg: string; ok: boolean } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const missing = r?.missing ?? [];
  const removable = missing.filter((m) => !m.checkedIn);

  async function removeThem() {
    setRemoving(true);
    const res = await removeMissing(removable.map((m) => m.ticket));
    setRemoving(false);
    setRemoval(
      res.error
        ? { ok: false, msg: res.error }
        : { ok: true, msg: `Removed ${res.removed} people. Re-run the import to refresh this report.` },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Import registrations
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload the .xlsx export from the registration system. Only rows with
          Status = <b>Paid</b> are imported. Safe to repeat: new people are
          added, details of existing people are refreshed, and anyone already
          checked in stays checked in. People missing from a newer file are
          listed below so you can remove them - but only do that when the file
          is the <b>complete</b> list, not just the latest additions.
        </p>
      </div>

      <form action={action} onSubmit={() => setRemoval(null)} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          className="block w-full rounded-md border border-zinc-300 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </form>

      {r?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {r.error}
        </p>
      )}

      {r && !r.error && (
        <section className="space-y-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
            Import complete
          </p>
          <ul className="space-y-1">
            <li>Rows in file: <b>{r.totalRows}</b></li>
            <li>Paid (imported): <b>{r.paid}</b> — <b>{r.added}</b> new, <b>{r.updated}</b> already known</li>
            <li>Skipped, not Paid: <b>{r.skippedNotPaid}</b></li>
            {!!r.skippedNoTicket && <li>Skipped, no ticket number: <b>{r.skippedNoTicket}</b></li>}
          </ul>

          {!!r.addedNames?.length && (
            <details>
              <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
                New people ({r.added}
                {(r.added ?? 0) > r.addedNames.length ? `, first ${r.addedNames.length} shown` : ""})
              </summary>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{r.addedNames.join(", ")}</p>
            </details>
          )}

          {!!missing.length && (
            <div className="rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-semibold">
                {missing.length} people are in the system but NOT in this file
              </p>
              <p className="mb-2">
                They came from an earlier import: cancelled, refunded, or
                left out of this list. If the file is your final, complete
                list, remove them so they don&apos;t get a pass or count as
                expected. <b>If this file only contains new registrations, ignore
                this and do not remove anyone.</b> Team members and anyone
                already checked in are never removed.
              </p>
              <ul className="mb-2 max-h-56 list-disc space-y-0.5 overflow-auto pl-5">
                {missing.map((m) => (
                  <li key={m.ticket}>
                    {m.name} <span className="font-mono text-xs">({m.ticket})</span>
                    {m.checkedIn && <b> — already checked in, will be kept</b>}
                    {m.passEmailed && <span> — pass already emailed</span>}
                  </li>
                ))}
              </ul>
              {removable.length > 0 && (
                <button
                  onClick={() => setConfirmRemove(true)}
                  disabled={removing}
                  className="rounded-md bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                >
                  {removing ? "Removing…" : `Remove ${removable.length} people`}
                </button>
              )}
              {removal && (
                <p className={`mt-2 ${removal.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-400"}`}>
                  {removal.msg}
                </p>
              )}
            </div>
          )}

          {!!r.duplicates?.length && (
            <div className="rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-semibold">
                Same email on more than one paid ticket ({r.duplicates.length})
              </p>
              <p className="mb-1">
                Often a group booking (one person registering several
                attendees), in which case each ticket gets its own pass email.
                Otherwise it may be a double payment - decide which ticket is
                real, or whether to refund one.
              </p>
              <ul className="list-disc pl-5">
                {r.duplicates.map((d) => (
                  <li key={d.email}>
                    {d.email}: {d.people.map((p) => `${p.ticket} (${p.name})`).join(" and ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove these people?"
          message={`Remove ${removable.length} people who are not in the latest file? This cannot be undone. Anyone already checked in is kept.`}
          confirmLabel="Yes, remove"
          cancelLabel="Cancel"
          destructive
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            removeThem();
          }}
        />
      )}
    </div>
  );
}
