import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";

const SECTIONS = [
  { href: "/admin/users", label: "Users", desc: "Roles, portfolios, active status" },
  { href: "/admin/portfolios", label: "Portfolios", desc: "Add or remove portfolios" },
  { href: "/admin/categories", label: "Expense Categories", desc: "Categories and subcategories" },
  { href: "/admin/events", label: "Events", desc: "Events / initiatives tied to a portfolio" },
  { href: "/admin/reconciliation", label: "Bank Reconciliation", desc: "Import expenses and bank statement, reconcile by cheque number" },
  { href: "/admin/visibility", label: "Expense Visibility", desc: "Control who can see other portfolios' expenses" },
  { href: "/admin/approval-flow", label: "Approval Flow", desc: "Configure the order of roles an expense routes through" },
  { href: "/admin/budgets", label: "Budgets", desc: "Import the approved portfolio budgets for the Budget vs Actual report" },
];

export default async function AdminPage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Administration
      </h1>

      {profile?.role !== "admin" ? (
        <div className="mt-4">
          <AccessDenied />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <p className="font-medium text-zinc-950 dark:text-zinc-50">
                {s.label}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {s.desc}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
