import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import ImportForm from "./ImportForm";

export default async function AdminImportPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Bulk Import Expenses
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Imports historical expenses directly as <strong>Paid</strong>, skipping the
        approval workflow entirely. Portfolio, category, event, and submitter values
        must match existing names/emails already set up in Admin.
      </p>

      <div className="mt-4 max-w-2xl rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="font-medium text-zinc-950 dark:text-zinc-50">
          Columns (header row required) — upload the .xlsx directly, or a .csv
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Required: <code>date</code>, <code>portfolio</code>, <code>category</code>,{" "}
          <code>description</code>, <code>payment_method</code>, <code>amount</code>
          <br />
          Optional: <code>event</code>, <code>vendor</code>, <code>remarks</code>,{" "}
          <code>submitted_by</code> (email — defaults to you if left blank),{" "}
          <code>cheque_number</code>, <code>entry_type</code>
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Dates: <code>YYYY-MM-DD</code> or <code>1-Jul-25</code>. Payment method:{" "}
          <code>cheque</code>, <code>bank_transfer</code>, or <code>cash</code>.
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          <code>entry_type</code>: <code>expense</code> (default, leave blank) or{" "}
          <code>reversal</code> — use <code>reversal</code> to record a historical
          correction that offsets an earlier expense (e.g. a cheque that
          bounced). The amount is still entered as a positive number;
          it&rsquo;s netted out automatically in the dashboard and reports. A
          bulk-imported reversal isn&rsquo;t linked to one specific original
          row — for that, use the <strong> Reverse</strong> button on an
          individual expense instead.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
{`date,portfolio,category,event,description,vendor,payment_method,amount,remarks,submitted_by,cheque_number,entry_type
1-Jul-25,Finance & Audit,Miscellaneous,,Office supplies,ABC Traders,cheque,1500,,someone@pmibdchapter.org,CHQ-00123,
3-Aug-25,Membership,Utilities,,Reversal: August gas bill was billed twice,,bank_transfer,540,Duplicate billing corrected,dir.finance@pmibdchapter.org,,reversal`}
        </pre>
      </div>

      <ImportForm />
    </div>
  );
}
