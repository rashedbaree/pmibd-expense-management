"use client";

import { useState } from "react";
import { IMPORT_MAX_FILE_SIZE_MB } from "@/lib/constants";

const MAX_FILE_SIZE_BYTES = IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ImportForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(
        `${file.name} is over the ${IMPORT_MAX_FILE_SIZE_MB}MB limit. Please choose a smaller file.`,
      );
      e.target.value = "";
      return;
    }
    setFileError(null);
  }

  return (
    <form action={action} className="mt-6 max-w-md">
      <label className="flex flex-col gap-1 text-sm">
        CSV or Excel file
        <input
          name="file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          onChange={handleFileChange}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {fileError && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {fileError}
        </p>
      )}

      <button
        type="submit"
        className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
      >
        Import
      </button>
    </form>
  );
}
