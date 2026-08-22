import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { importBankStatement, importExpenses } from "./actions";
import ExpenseImportForm from "./expense-import-form";
import BankImportForm from "./bank-import-form";
import ReconcileReport from "./reconcile-report";

const EXPENSE_SAMPLE_CSV = `date,portfolio,category,event,description,vendor,payment_method,amount,remarks,submitted_by,cheque_number,entry_type
1-Jul-25,Finance & Audit,Miscellaneous,,Office supplies,ABC Traders,cheque,1500,,,000123,
3-Aug-25,Membership,Utilities,,Reversal: August gas bill was billed twice,,bank_transfer,850,,,,reversal`;

const BANK_SAMPLE_CSV = `date,cheque_number,amount,description,remarks
3-Jul-25,000123,1500,ABC TRADERS,cleared
10-Aug-25,000145,2200,XYZ VENUE LTD,`;

type ExpenseRow = {
  id: string;
  date: string;
  amount: number;
  description: string;
  cheque_number: string | null;
  status: string;
};

type BankRow = {
  id: string;
  date: string;
  amount: number;
  cheque_number: string;
  description: string | null;
  remarks: string | null;
};

export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: "expenses" | "bank";
    error?: string;
    created?: string;
    errors?: string;
    moreErrors?: string;
  }>;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;

  if (!profile || profile.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Bank Reconciliation
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: expenseRows }, { data: bankRows }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, date, amount, description, cheque_number, status")
      .not("cheque_number", "is", null)
      .order("date", { ascending: false }),
    supabase
      .from("bank_statement_lines")
      .select("id, date, amount, cheque_number, description, remarks")
      .order("date", { ascending: false }),
  ]);

  const expenses = (expenseRows ?? []) as ExpenseRow[];
  const bankLines = (bankRows ?? []) as BankRow[];

  const expensesByCheque = new Map<string, ExpenseRow[]>();
  for (const e of expenses) {
    const key = (e.cheque_number ?? "").trim();
    if (!key) continue;
    expensesByCheque.set(key, [...(expensesByCheque.get(key) ?? []), e]);
  }

  const bankByCheque = new Map<string, BankRow[]>();
  for (const b of bankLines) {
    const key = b.cheque_number.trim();
    if (!key) continue;
    bankByCheque.set(key, [...(bankByCheque.get(key) ?? []), b]);
  }

  const allCheques = [
    ...new Set([...expensesByCheque.keys(), ...bankByCheque.keys()]),
  ].sort();

  const matched: { cheque: string; expense: ExpenseRow; bank: BankRow }[] = [];
  const unmatchedExpenses: ExpenseRow[] = [];
  const unmatchedBank: BankRow[] = [];

  for (const cheque of allCheques) {
    const exps = expensesByCheque.get(cheque) ?? [];
    const banks = bankByCheque.get(cheque) ?? [];
    const pairCount = Math.min(exps.length, banks.length);
    for (let i = 0; i < pairCount; i++) {
      matched.push({ cheque, expense: exps[i], bank: banks[i] });
    }
    unmatchedExpenses.push(...exps.slice(pairCount));
    unmatchedBank.push(...banks.slice(pairCount));
  }

  const showExpenseResult = params.source === "expenses";
  const showBankResult = params.source === "bank";
  const rowErrors = params.errors ? params.errors.split("|") : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Bank Reconciliation
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Import historical expenses and your bank&apos;s statement, then
          match them by cheque number to confirm every cheque expense
          actually cleared the bank.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
          1. Import Expenses
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Imports historical expenses directly as <strong>Paid</strong>,
          skipping the approval workflow entirely. Portfolio, category,
          event, and submitter values must match existing names/emails
          already set up in Admin.
        </p>
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <strong className="text-zinc-950 dark:text-zinc-50">Required:</strong>{" "}
            date, portfolio, category, description, payment_method, amount
            <br />
            <strong className="text-zinc-950 dark:text-zinc-50">Optional:</strong>{" "}
            event, vendor, remarks, submitted_by (email — defaults to you if
            left blank), cheque_number, entry_type
          </p>
          <p className="mt-2">
            Dates: <code>YYYY-MM-DD</code> or <code>1-Jul-25</code>. Payment
            method: <code>cheque</code>, <code>bank_transfer</code>, or{" "}
            <code>cash</code>.
          </p>
          <p className="mt-2">
            <code>entry_type</code>: <code>expense</code> (default, leave
            blank) or <code>reversal</code> — use <code>reversal</code> to
            record a historical correction that offsets an earlier expense
            (e.g. a cheque that bounced). The amount is still entered as a
            positive number; it&apos;s netted out automatically in the
            dashboard and reports. A bulk-imported reversal isn&apos;t
            linked to one specific original row — it only affects aggregate
            totals.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {EXPENSE_SAMPLE_CSV}
          </pre>
        </div>

        {showExpenseResult && params.error && (
          <p className="mt-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {params.error}
          </p>
        )}
        {showExpenseResult && params.created !== undefined && rowErrors.length === 0 && (
          <div className="mt-4 max-w-3xl rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Imported {params.created} expense
            {params.created === "1" ? "" : "s"}.
          </div>
        )}
        {showExpenseResult && rowErrors.length > 0 && (
          <div className="mt-3 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            <p className="font-medium">
              Nothing was imported — fix {rowErrors.length} row
              {rowErrors.length === 1 ? "" : "s"} below and re-upload:
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

        <ExpenseImportForm action={importExpenses} />
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
          2. Import Bank Statement
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload your bank&apos;s statement export. Each line is matched
          against expenses by cheque number.
        </p>
        <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <strong className="text-zinc-950 dark:text-zinc-50">Required:</strong>{" "}
            date, cheque_number, amount
            <br />
            <strong className="text-zinc-950 dark:text-zinc-50">Optional:</strong>{" "}
            description, remarks (kept for audit reference)
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {BANK_SAMPLE_CSV}
          </pre>
        </div>

        {showBankResult && params.error && (
          <p className="mt-4 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {params.error}
          </p>
        )}
        {showBankResult && params.created !== undefined && rowErrors.length === 0 && (
          <div className="mt-4 max-w-3xl rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Imported {params.created} bank statement line
            {params.created === "1" ? "" : "s"}.
          </div>
        )}
        {showBankResult && rowErrors.length > 0 && (
          <div className="mt-3 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            <p className="font-medium">
              Nothing was imported — fix {rowErrors.length} row
              {rowErrors.length === 1 ? "" : "s"} below and re-upload:
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

        <BankImportForm action={importBankStatement} />
      </section>

      <ReconcileReport
        matched={matched}
        unmatchedExpenses={unmatchedExpenses}
        unmatchedBank={unmatchedBank}
      />
    </div>
  );
}
