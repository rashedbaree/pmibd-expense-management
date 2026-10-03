"use client";

import { useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatAmount } from "@/lib/booth";
import type { BoothPackage, EventRow } from "@/lib/types";
import {
  BOOTH_NUMBER_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  ORGANIZATION_NAME_MAX_LENGTH,
  REMARKS_MAX_LENGTH,
} from "@/lib/constants";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default function NewBookingForm({
  action,
  events,
  packages,
  bookedPerPackage,
}: {
  action: (formData: FormData) => void;
  events: EventRow[];
  packages: BoothPackage[];
  bookedPerPackage: Record<string, number>;
}) {
  const [eventId, setEventId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [amount, setAmount] = useState("");
  const [organization, setOrganization] = useState("");
  const [remarksLength, setRemarksLength] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);

  const eventPackages = useMemo(
    () => packages.filter((p) => p.event_id === eventId),
    [packages, eventId],
  );

  const selectedPackage = eventPackages.find((p) => p.id === packageId) ?? null;

  // Blank means "use the package price", which the server action resolves.
  // Typing a figure overrides it for a negotiated booth.
  const effectiveAmount = amount.trim()
    ? Number(amount.replace(/,/g, ""))
    : (selectedPackage?.price ?? null);

  function remaining(pkg: BoothPackage): number | null {
    if (pkg.total_booths === null) return null;
    return pkg.total_booths - (bookedPerPackage[pkg.id] ?? 0);
  }

  function handleEventChange(value: string) {
    setEventId(value);
    // Packages belong to one event, so the old choice can't carry over.
    setPackageId("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) return;
    e.preventDefault();
    setShowConfirm(true);
  }

  function confirmSubmit() {
    setShowConfirm(false);
    confirmedRef.current = true;
    formRef.current?.requestSubmit();
  }

  const soldOut = selectedPackage ? remaining(selectedPackage) === 0 : false;

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={handleSubmit}
        className="mt-6 flex max-w-2xl flex-col gap-4 text-sm"
      >
        <label className="flex flex-col gap-1">
          Event
          <select
            name="event_id"
            required
            value={eventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select event
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.date}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Booth Package
          <select
            name="package_id"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            disabled={!eventId}
            className={`${inputClass} disabled:opacity-50`}
          >
            <option value="">
              {eventId && eventPackages.length === 0
                ? "No packages set up for this event"
                : "None — price this booth manually"}
            </option>
            {eventPackages.map((p) => {
              const left = remaining(p);
              return (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatAmount(p.price)}
                  {left === null ? "" : ` · ${left} left`}
                </option>
              );
            })}
          </select>
          {soldOut && (
            <span className="text-amber-700 dark:text-amber-400">
              Every booth in this package is already booked. You can still
              register this one, but check the floor plan first.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          Organisation
          <input
            name="organization_name"
            required
            maxLength={ORGANIZATION_NAME_MAX_LENGTH}
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            Contact Name
            <input
              name="contact_name"
              required
              maxLength={CONTACT_NAME_MAX_LENGTH}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            Contact Email
            <input
              name="contact_email"
              type="email"
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            Contact Phone
            <input
              name="contact_phone"
              maxLength={CONTACT_PHONE_MAX_LENGTH}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            Booth Number
            <input
              name="booth_number"
              maxLength={BOOTH_NUMBER_MAX_LENGTH}
              placeholder="Assign later if unknown"
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          Price
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={
              selectedPackage
                ? `${formatAmount(selectedPackage.price)} (package price)`
                : "Booth price"
            }
            className={inputClass}
          />
          <span className="text-zinc-500">
            {selectedPackage
              ? "Leave blank to charge the package price, or type a negotiated figure."
              : "The agreed price for this booth."}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          Remarks
          <textarea
            name="remarks"
            rows={2}
            maxLength={REMARKS_MAX_LENGTH}
            onChange={(e) => setRemarksLength(e.target.value.length)}
            className={inputClass}
          />
          <span className="text-right text-xs text-zinc-500">
            {remarksLength}/{REMARKS_MAX_LENGTH}
          </span>
        </label>

        <div>
          <button className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand/90">
            Reserve Booth
          </button>
        </div>
      </form>

      {showConfirm && (
        <ConfirmDialog
          title="Please Confirm"
          message={`Reserve a booth for ${organization.trim() || "this organisation"}${
            effectiveAmount === null
              ? ""
              : ` at ${formatAmount(effectiveAmount)}`
          }? Finance confirms it once payment is agreed.`}
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmSubmit}
        />
      )}
    </>
  );
}
