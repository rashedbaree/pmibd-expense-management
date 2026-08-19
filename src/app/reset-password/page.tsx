import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error: formError } = await searchParams;
  const supabase = await createClient();

  let exchangeError: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) exchangeError = error.message;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-brand-deep">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Set a new password
          </h1>
        </div>

        {(exchangeError || formError) && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {exchangeError ?? formError}
          </p>
        )}

        {!user ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This reset link is invalid or has expired. Request a new one from
            the sign-in page.
          </p>
        ) : (
          <form action={updatePassword} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              New password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
