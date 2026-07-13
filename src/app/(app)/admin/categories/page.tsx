import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { addCategory, deleteCategory } from "../actions";
import type { ExpenseCategory } from "@/lib/types";

export default async function AdminCategoriesPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Expense Categories
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("expense_categories")
    .select("id, name, parent_category_id")
    .order("name");

  const rows = (categories ?? []) as ExpenseCategory[];
  const parents = rows.filter((c) => !c.parent_category_id);
  const ordered = parents.flatMap((parent) => [
    parent,
    ...rows.filter((c) => c.parent_category_id === parent.id),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Expense Categories
      </h1>

      <form
        action={addCategory}
        className="mt-4 flex max-w-lg flex-wrap gap-2"
      >
        <input
          name="name"
          required
          placeholder="Category name"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          name="parent_category_id"
          defaultValue=""
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">No parent (top-level)</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950">
          Add
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {ordered.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            {c.parent_category_id ? `— ${c.name}` : c.name}
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <button className="text-red-600 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {ordered.length === 0 && (
          <p className="text-sm text-zinc-500">No categories yet.</p>
        )}
      </div>
    </div>
  );
}
