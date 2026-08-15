"use client";

import { useActionState } from "react";
import { importBankTransactions, type BankImportResult } from "./actions";

const initialState: BankImportResult = { successCount: 0, duplicateCount: 0, errors: [] };

export default function BankImportForm() {
  const [state, formAction, isPending] = useActionState(importBankTransactions, initialState);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          CSV or Excel file
          <input
            name="file"
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            required
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand/90 disabled:opacity-50"
        >
          {isPending ? "Importing..." : "Import"}
        </button>
      </form>

      {state.successCount > 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          Imported {state.successCount} transaction{state.successCount === 1 ? "" : "s"}.
          {state.duplicateCount > 0
            ? ` Skipped ${state.duplicateCount} already-uploaded duplicate${state.duplicateCount === 1 ? "" : "s"}.`
            : ""}
        </p>
      )}

      {state.successCount === 0 && state.duplicateCount > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          All {state.duplicateCount} row{state.duplicateCount === 1 ? "" : "s"} were already
          uploaded — nothing new to import.
        </p>
      )}

      {state.errors.length > 0 && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          <p className="font-medium">{state.errors.length} issue(s):</p>
          <ul className="mt-1 list-disc pl-5">
            {state.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
