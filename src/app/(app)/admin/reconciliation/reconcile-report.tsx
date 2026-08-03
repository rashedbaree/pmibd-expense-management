"use client";

export type MatchedPair = {
  cheque: string;
  expense: {
    id: string;
    date: string;
    amount: number;
    description: string;
  };
  bank: {
    id: string;
    date: string;
    amount: number;
    description: string | null;
    remarks: string | null;
  };
};

export type UnmatchedExpense = {
  id: string;
  date: string;
  amount: number;
  description: string;
  cheque_number: string | null;
};

export type UnmatchedBankLine = {
  id: string;
  date: string;
  amount: number;
  cheque_number: string;
  description: string | null;
  remarks: string | null;
};

function formatAmount(n: number) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const lines = [header, ...rows];
  const csv = lines
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReconcileReport({
  matched,
  unmatchedExpenses,
  unmatchedBank,
}: {
  matched: MatchedPair[];
  unmatchedExpenses: UnmatchedExpense[];
  unmatchedBank: UnmatchedBankLine[];
}) {
  function exportAll() {
    downloadCsv(
      "reconciliation-matched.csv",
      [
        "Cheque #",
        "Expense Date",
        "Expense Description",
        "Expense Amount",
        "Bank Date",
        "Bank Description",
        "Bank Remarks",
        "Bank Amount",
        "Delta",
      ],
      matched.map(({ cheque, expense, bank }) => [
        cheque,
        expense.date,
        expense.description,
        expense.amount.toFixed(2),
        bank.date,
        bank.description ?? "",
        bank.remarks ?? "",
        bank.amount.toFixed(2),
        (Number(expense.amount) - Number(bank.amount)).toFixed(2),
      ]),
    );
    downloadCsv(
      "reconciliation-expenses-without-bank-line.csv",
      ["Cheque #", "Date", "Description", "Amount"],
      unmatchedExpenses.map((e) => [
        e.cheque_number ?? "",
        e.date,
        e.description,
        e.amount.toFixed(2),
      ]),
    );
    downloadCsv(
      "reconciliation-bank-lines-without-expense.csv",
      ["Cheque #", "Date", "Description", "Remarks", "Amount"],
      unmatchedBank.map((b) => [
        b.cheque_number,
        b.date,
        b.description ?? "",
        b.remarks ?? "",
        b.amount.toFixed(2),
      ]),
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
          3. Reconciliation Report
        </h2>
        <div className="print:hidden flex gap-2">
          <button
            type="button"
            onClick={exportAll}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Export CSV (Excel)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand/90"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Cheque #</th>
              <th className="px-3 py-2">Expense Date</th>
              <th className="px-3 py-2">Expense Description</th>
              <th className="px-3 py-2 text-right">Expense Amount</th>
              <th className="px-3 py-2">Bank Date</th>
              <th className="px-3 py-2 text-right">Bank Amount</th>
              <th className="px-3 py-2 text-right">Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {matched.map(({ cheque, expense, bank }) => {
              const delta = Number(expense.amount) - Number(bank.amount);
              return (
                <tr key={`${cheque}-${expense.id}-${bank.id}`}>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {cheque}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{expense.date}</td>
                  <td className="max-w-xs truncate px-3 py-2" title={expense.description}>
                    {expense.description}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatAmount(expense.amount)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{bank.date}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatAmount(bank.amount)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right whitespace-nowrap ${
                      delta !== 0
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {formatAmount(delta)}
                  </td>
                </tr>
              );
            })}
            {matched.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  No matched cheques yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 font-medium dark:border-zinc-800">
              <td colSpan={3} className="px-3 py-2">
                Total ({matched.length})
              </td>
              <td className="px-3 py-2 text-right">
                {formatAmount(matched.reduce((s, m) => s + Number(m.expense.amount), 0))}
              </td>
              <td />
              <td className="px-3 py-2 text-right">
                {formatAmount(matched.reduce((s, m) => s + Number(m.bank.amount), 0))}
              </td>
              <td className="px-3 py-2 text-right">
                {formatAmount(
                  matched.reduce(
                    (s, m) => s + (Number(m.expense.amount) - Number(m.bank.amount)),
                    0,
                  ),
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            Expenses with no matching bank line ({unmatchedExpenses.length})
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Cheque #</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {unmatchedExpenses.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {e.cheque_number}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.date}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2" title={e.description}>
                      {e.description}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatAmount(e.amount)}
                    </td>
                  </tr>
                ))}
                {unmatchedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                      None — every cheque expense has cleared.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            Bank lines with no matching expense ({unmatchedBank.length})
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Cheque #</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {unmatchedBank.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {b.cheque_number}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{b.date}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2" title={b.description ?? undefined}>
                      {b.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatAmount(b.amount)}
                    </td>
                  </tr>
                ))}
                {unmatchedBank.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                      None — every bank cheque has a matching expense.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
