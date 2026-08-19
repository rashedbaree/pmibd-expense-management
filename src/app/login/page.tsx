import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-brand-deep">
      <form
        action={login}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            PMI Bangladesh
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Expense Management System
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        {message && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            {message}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          Sign in
        </button>

        <Link
          href="/forgot-password"
          className="text-center text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
