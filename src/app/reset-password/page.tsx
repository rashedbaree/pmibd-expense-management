import { updatePassword } from "./actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-brand-deep">
      <form
        action={updatePassword}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Set a new password
          </h1>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            pattern="(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
            title={`At least ${MIN_PASSWORD_LENGTH} characters, including 1 uppercase letter, 1 number, and 1 symbol`}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-xs text-zinc-500">
            At least {MIN_PASSWORD_LENGTH} characters, with 1 uppercase
            letter, 1 number, and 1 symbol.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Confirm new password
          <input
            name="confirm_password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
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
    </div>
  );
}
