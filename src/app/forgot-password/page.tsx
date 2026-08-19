import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-brand-deep">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Reset your password
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter your account email and we&apos;ll send a reset link.
          </p>
        </div>

        {sent ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            If that email has an account, a reset link is on its way.
          </p>
        ) : (
          <form action={requestPasswordReset} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                name="email"
                type="email"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Send reset link
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="text-center text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
