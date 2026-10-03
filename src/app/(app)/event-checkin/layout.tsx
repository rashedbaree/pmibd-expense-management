import { getCurrentProfile } from "@/lib/auth";
import { AccessDenied } from "@/components/AccessDenied";
import BackLink from "@/components/checkin/BackLink";

// Everything under /event-checkin is administrators-only. This is the
// friendly gate; the real enforcement is in the database (RLS on the
// checkin_* tables) and in each server action / route handler, because a
// layout isn't re-run on every client-side navigation.
export default async function EventCheckinLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Event check in
        </h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <BackLink />
      {children}
    </div>
  );
}
