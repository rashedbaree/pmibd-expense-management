"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
    >
      Print / Save as PDF
    </button>
  );
}
