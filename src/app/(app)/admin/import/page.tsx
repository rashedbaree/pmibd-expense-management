import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { importExpenses } from "./actions";
import ImportForm from "./form";

const SAMPLE_CSV = `date,portfolio,category,event,description,vendor,payment_method,amount,remarks,submitted_by,cheque_number,entry_type
1-Jul-25,Finance & Audit,Miscellaneous,,Office supplies,ABC Traders,cheque,1500,,,000123,
3-Aug-25,Membership,Utilities,,Reversal: August gas bill was billed twice,,bank_transfer,850,,,,reversal`;

export default async function AdminImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; errors?: string; moreErrors?: string }>;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;

  if (!profile || profile.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Bulk Import Expenses
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const rowErrors = params.errors ? params.errors.split("|") : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Bulk Import Expenses
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        Imports historical expenses directly as <strong>Paid</strong>,
        skipping the approval workflow entirely. Portfolio, category, event,
        and submitter values must match existing names/emails already set up
        in Admin.
      </p>

      <div className="mt-4 max-w-3xl rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="text-zinc-700 dark:text-zinc-300">
          Columns (header row required) — upload the .xlsx directly, or a
          .csv
        </p>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          <strong className="text-zinc-950 dark:text-zinc-50">Required:</strong>{" "}
          date, portfolio, category, description, payment_method, amount
          <br />
          <strong className="text-zinc-950 dark:text-zinc-50">Optional:</strong>{" "}
          event, vendor, remarks, submitted_by (email — defaults to you if
          left blank), cheque_number, entry_type
        </p>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Dates: <code>YYYY-MM-DD</code> or <code>1-Jul-25</code>. Payment
          method: <code>cheque</code>, <code>bank_transfer</code>, or{" "}
          <code>cash</code>.
        </p>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          <code>entry_type</code>: <code>expense</code> (default, leave
          blank) or <code>reversal</code> — use <code>reversal</code> to
          record a historical correction that offsets an earlier expense
          (e.g. a cheque that bounced). The amount is still entered as a
          positive number; it&apos;s netted out automatically in the
          dashboard and reports. A bulk-imported reversal isn&apos;t linked
          to one specific original row — it only affects aggregate totals.
        </p>

        <pre className="mt-3 overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {SAMPLE_CSV}
        </pre>
      </div>

      {params.error && (
        <p className="mt-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {params.error}
        </p>
      )}

      {params.created !== undefined && (
        <div className="mt-4 max-w-3xl rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          Imported {params.created} expense{params.created === "1" ? "" : "s"}.
        </div>
      )}

      {rowErrors.length > 0 && (
        <div className="mt-3 max-w-3xl rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <p className="font-medium">
            {rowErrors.length} row{rowErrors.length === 1 ? "" : "s"} skipped:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {rowErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {params.moreErrors && (
            <p className="mt-1">…and {params.moreErrors} more.</p>
          )}
        </div>
      )}

      <ImportForm action={importExpenses} />
    </div>
  );
}
