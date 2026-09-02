"use client";

import { useMemo, useRef, useState } from "react";
import type { EventRow, ExpenseCategory, Portfolio } from "@/lib/types";
import type { BudgetSnapshot } from "@/lib/budget";
import {
  useBudgetWarning,
  BudgetWarningBanner,
  BudgetWarningModal,
} from "@/components/BudgetWarning";
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

type ExpenseDefaults = {
  date: string;
  portfolio_id: string;
  event_id: string | null;
  category_id: string;
  description: string;
  vendor: string | null;
  payment_method: string;
  amount: number;
  remarks: string | null;
};

export default function EditExpenseForm({
  action,
  expenseId,
  portfolios,
  events,
  categories,
  vendors,
  budgetSnapshot,
  defaults,
}: {
  action: (formData: FormData) => void;
  expenseId: string;
  portfolios: Portfolio[];
  events: EventRow[];
  categories: ExpenseCategory[];
  vendors: string[];
  budgetSnapshot: BudgetSnapshot;
  defaults: ExpenseDefaults;
}) {
  const [portfolioId, setPortfolioId] = useState(defaults.portfolio_id);
  const [categoryId, setCategoryId] = useState(defaults.category_id);
  const [date, setDate] = useState(defaults.date);
  const [amount, setAmount] = useState(Number(defaults.amount) || 0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [descriptionLength, setDescriptionLength] = useState(
    defaults.description.length,
  );
  const [remarksLength, setRemarksLength] = useState(
    defaults.remarks?.length ?? 0,
  );
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const budgetAcknowledgedRef = useRef(false);

  const budgetWarning = useBudgetWarning(budgetSnapshot, portfolioId, categoryId, date, amount);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (budgetWarning && !budgetAcknowledgedRef.current) {
      e.preventDefault();
      setShowBudgetModal(true);
    }
  }

  function confirmOverBudgetSubmit() {
    budgetAcknowledgedRef.current = true;
    setShowBudgetModal(false);
    formRef.current?.requestSubmit();
  }

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
      ref={formRef}
      action={action}
      onSubmit={handleSubmit}
      className="mt-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="expense_id" value={expenseId} />
      <label className="flex flex-col gap-1 text-sm">
        Date
        <input
          name="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
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
        <select
          name="event_id"
          defaultValue={defaults.event_id ?? ""}
          className={inputClass}
        >
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
        <select
          name="category_id"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClass}
        >
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
          defaultValue={defaults.payment_method}
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
          defaultValue={defaults.vendor ?? ""}
          className={inputClass}
        />
        <datalist id="vendor-suggestions">
          {vendors.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Add Supporting Documents (optional)
        <input
          name="document"
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFileChange}
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">
          Up to {MAX_FILE_SIZE_MB}MB per file. Existing attachments stay as-is.
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
          defaultValue={defaults.description}
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
          defaultValue={defaults.remarks ?? ""}
          onChange={(e) => setRemarksLength(e.target.value.length)}
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">
          {remarksLength}/{REMARKS_MAX_LENGTH}
        </span>
      </label>

      <BudgetWarningBanner warning={budgetWarning} />

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          Resubmit for Approval
        </button>
      </div>

      {showBudgetModal && budgetWarning && (
        <BudgetWarningModal
          warning={budgetWarning}
          onCancel={() => setShowBudgetModal(false)}
          onConfirm={confirmOverBudgetSubmit}
        />
      )}
    </form>
  );
}
