"use client";

import { useMemo, useState } from "react";
import type { EventRow, ExpenseCategory, Portfolio } from "@/lib/types";
import { DESCRIPTION_MAX_LENGTH, REMARKS_MAX_LENGTH } from "@/lib/constants";

const PAYMENT_METHODS = [
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
];

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function NewExpenseForm({
  action,
  portfolios,
  events,
  categories,
  vendors,
}: {
  action: (formData: FormData) => void;
  portfolios: Portfolio[];
  events: EventRow[];
  categories: ExpenseCategory[];
  vendors: string[];
}) {
  const [portfolioId, setPortfolioId] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [remarksLength, setRemarksLength] = useState(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setFileError(
        `${oversized.map((f) => f.name).join(", ")} ${oversized.length === 1 ? "is" : "are"} over the ${MAX_FILE_SIZE_MB}MB limit per file. Please choose smaller files.`,
      );
      e.target.value = "";
      return;
    }
    setFileError(null);
  }

  const filteredEvents = useMemo(
    () => events.filter((e) => !portfolioId || e.portfolio_id === portfolioId),
    [events, portfolioId],
  );

  const orderedCategories = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_category_id);
    const children = categories.filter((c) => c.parent_category_id);
    return parents.flatMap((parent) => [
      parent,
      ...children.filter((c) => c.parent_category_id === parent.id),
    ]);
  }, [categories]);

  return (
    <form
      action={action}
      className="mt-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 text-sm">
        Date
        <input
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Amount (BDT)
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Portfolio
        <select
          name="portfolio_id"
          required
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select portfolio
          </option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Event / Initiative (optional)
        <select name="event_id" defaultValue="" className={inputClass}>
          <option value="">None</option>
          {filteredEvents.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Category
        <select name="category_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select category
          </option>
          {orderedCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent_category_id ? `— ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Payment Method
        <select
          name="payment_method"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            Select payment method
          </option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Vendor / Payee
        <input
          name="vendor"
          type="text"
          list="vendor-suggestions"
          className={inputClass}
        />
        <datalist id="vendor-suggestions">
          {vendors.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Supporting Documents
        <input
          name="document"
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFileChange}
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">
          Up to {MAX_FILE_SIZE_MB}MB per file.
        </span>
        {fileError && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {fileError}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Description
        <textarea
          name="description"
          required
          rows={3}
          maxLength={DESCRIPTION_MAX_LENGTH}
          onChange={(e) => setDescriptionLength(e.target.value.length)}
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">
          {descriptionLength}/{DESCRIPTION_MAX_LENGTH}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Remarks
        <textarea
          name="remarks"
          rows={2}
          maxLength={REMARKS_MAX_LENGTH}
          onChange={(e) => setRemarksLength(e.target.value.length)}
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">
          {remarksLength}/{REMARKS_MAX_LENGTH}
        </span>
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          Submit Expense
        </button>
      </div>
    </form>
  );
}
