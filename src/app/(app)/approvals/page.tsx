import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { actOnExpense, markAsPaid } from "./actions";
import { CHEQUE_NUMBER_MAX_LENGTH, COMMENT_MAX_LENGTH } from "@/lib/constants";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, portfolio_id, name")
    .eq("id", user.id)
    .single();

  let pendingQuery = supabase
    .from("expenses")
    .select(
      `id, date, amount, description, vendor, remarks, required_approval_role, entry_type, over_budget,
       portfolio:portfolios(name),
       category:expense_categories(name),
       submitter:users!expenses_submitted_by_fkey(name, email),
       documents:expense_documents(id, file_url)`,
    )
    .eq("current_approver_role", profile?.role ?? "__none__")
    .order("date", { ascending: true });

  if (profile?.role === "portfolio_director") {
    pendingQuery = pendingQuery.eq("portfolio_id", profile.portfolio_id ?? "__none__");
  }

  const { data: rawPending } = await pendingQuery;
  const pending = rawPending as unknown as
    | {
        id: string;
        date: string;
        amount: number;
        description: string;
        vendor: string | null;
        remarks: string | null;
        entry_type: "expense" | "reversal";
        over_budget: boolean;
        portfolio: { name: string } | null;
        category: { name: string } | null;
        submitter: { name: string; email: string } | null;
        documents: { id: string; file_url: string }[];
      }[]
    | null;

  const documentPaths = (pending ?? []).flatMap((e) =>
    e.documents.map((d) => d.file_url),
  );
  const signedUrlByPath = new Map<string, string>();
  if (documentPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("expense-documents")
      .createSignedUrls(documentPaths, 3600);
    for (const s of signedUrls ?? []) {
      if (s.signedUrl && !s.error) signedUrlByPath.set(s.path ?? "", s.signedUrl);
    }
  }

  function attachmentName(fileUrl: string): string {
    const base = fileUrl.split("/").pop() ?? fileUrl;
    // Uploads are named "<uuid>-<original filename>"; a UUID is always 36
    // chars, so slicing past it plus its separating dash recovers the name
    // the submitter actually uploaded.
    return base.length > 37 ? base.slice(37) : base;
  }

  const canMarkPaid = profile?.role === "finance_director" || profile?.role === "admin";
  const { data: rawApprovedUnpaid } = canMarkPaid
    ? await supabase
        .from("expenses")
        .select(
          `id, date, amount, description, payment_method,
           portfolio:portfolios(name),
           submitter:users!expenses_submitted_by_fkey(name)`,
        )
        .eq("status", "approved")
        .order("date", { ascending: true })
    : { data: [] };
  const approvedUnpaid = rawApprovedUnpaid as unknown as
    | {
        id: string;
        date: string;
        amount: number;
        description: string;
        payment_method: string;
        portfolio: { name: string } | null;
        submitter: { name: string } | null;
      }[]
    | null;

  const { data: rawRecentActivity } = await supabase
    .from("expense_approvals")
    .select(
      `id, action, comment, acted_at,
       expense:expenses(id, description, amount)`,
    )
    .eq("approver_id", user.id)
    .order("acted_at", { ascending: false })
    .limit(10);
  const recentActivity = rawRecentActivity as unknown as
    | {
        id: string;
        action: string;
        comment: string | null;
        acted_at: string;
        expense: { id: string; description: string; amount: number } | null;
      }[]
    | null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Approvals
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {profile?.name} ({profile?.role})
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
          Awaiting your action
        </h2>
        <div className="mt-3 flex flex-col gap-4">
          {(pending ?? []).map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">
                    {e.entry_type === "reversal" && (
                      <span className="mr-1.5 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Reversal
                      </span>
                    )}
                    {e.over_budget && (
                      <span className="mr-1.5 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                        Over Budget
                      </span>
                    )}
                    {e.description}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {e.portfolio?.name} · {e.category?.name} · {e.date} ·
                    submitted by {e.submitter?.name}
                  </p>
                  {e.over_budget && (
                    <p className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">
                      This expense pushes {e.portfolio?.name} · {e.category?.name} over its
                      approved budget and requires Finance Director approval.
                    </p>
                  )}
                  {e.vendor && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Vendor: {e.vendor}
                    </p>
                  )}
                  {e.remarks && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Remarks: {e.remarks}
                    </p>
                  )}
                  {e.documents.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      {e.documents.map((d) => {
                        const url = signedUrlByPath.get(d.file_url);
                        return url ? (
                          <a
                            key={d.id}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:underline"
                          >
                            {attachmentName(d.file_url)}
                          </a>
                        ) : (
                          <span key={d.id} className="text-zinc-500">
                            {attachmentName(d.file_url)} (unavailable)
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No attachments</p>
                  )}
                </div>
                <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  {Number(e.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{" "}
                  BDT
                </p>
              </div>

              <form action={actOnExpense} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="expense_id" value={e.id} />
                <label className="flex flex-1 min-w-48 flex-col gap-1 text-sm">
                  Comment
                  <input
                    name="comment"
                    type="text"
                    maxLength={COMMENT_MAX_LENGTH}
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <button
                  name="intent"
                  value="approve"
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  name="intent"
                  value="return"
                  className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
                >
                  Return
                </button>
                <button
                  name="intent"
                  value="reject"
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </form>
            </div>
          ))}
          {(pending ?? []).length === 0 && (
            <p className="text-sm text-zinc-500">Nothing awaiting your action.</p>
          )}
        </div>
      </section>

      {canMarkPaid && (
        <section>
          <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
            Approved — ready to pay
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {(approvedUnpaid ?? []).map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
              >
                <span className="text-sm">
                  {e.date} · {e.portfolio?.name} · {e.description} ·{" "}
                  {e.submitter?.name} ·{" "}
                  {Number(e.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}{" "}
                  BDT
                </span>
                <form
                  action={markAsPaid}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="expense_id" value={e.id} />
                  {e.payment_method === "cheque" && (
                    <label className="flex flex-col gap-1 text-sm">
                      Cheque number
                      <input
                        name="cheque_number"
                        type="text"
                        maxLength={CHEQUE_NUMBER_MAX_LENGTH}
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                  )}
                  <button className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700">
                    Mark as Paid
                  </button>
                </form>
              </div>
            ))}
            {(approvedUnpaid ?? []).length === 0 && (
              <p className="text-sm text-zinc-500">Nothing awaiting payment.</p>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
          Your recent decisions
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Expense</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(recentActivity ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(a.acted_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{a.expense?.description}</td>
                  <td className="px-3 py-2 capitalize">{a.action}</td>
                  <td className="px-3 py-2">{a.comment}</td>
                </tr>
              ))}
              {(recentActivity ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    No decisions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
