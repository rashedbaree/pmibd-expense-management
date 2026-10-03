import { createClient } from "@/lib/supabase/server";
import { ATTENDEES_TABLE } from "@/lib/checkin/attendees";
import { smtpConfigured } from "@/lib/checkin/mail";
import PassSender from "./sender";

// Each server-action call sends a batch of emails; give it room on hosts
// with a short default function timeout.
export const maxDuration = 60;

export default async function PassesPage() {
  const supabase = await createClient();

  const count = async (team: boolean, emailed: boolean) => {
    const base = supabase
      .from(ATTENDEES_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("source", "import")
      .not("email", "is", null)
      .eq("is_team", team);
    const { count: c } = emailed
      ? await base.not("pass_emailed_at", "is", null)
      : await base.is("pass_emailed_at", null);
    // A HEAD count against a missing table comes back null with no error,
    // which would read as "0 pending". Say what's actually wrong instead.
    if (c === null) {
      throw new Error(
        "The Event check in tables aren't set up in this database - run supabase/migrations/0016_event_checkin.sql.",
      );
    }
    return c;
  };
  const [teamPending, teamDone, regPending, regDone] = await Promise.all([
    count(true, false),
    count(true, true),
    count(false, false),
    count(false, true),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Email QR passes
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Each person gets an email with their personal QR code and their
          details. They show it at the booth and the scan checks them in.
          Replies go to info@pmibdchapter.org.
        </p>
      </div>

      {!smtpConfigured() && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          SMTP is not configured on the server, so nothing can be sent yet.
          Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD.
        </p>
      )}

      <ul className="space-y-1 text-sm">
        <li>
          Team (BOD, volunteers…): emailed <b>{teamDone}</b> · not yet <b>{teamPending}</b>
        </li>
        <li>
          Registered attendees: emailed <b>{regDone}</b> · not yet <b>{regPending}</b>
        </li>
      </ul>

      <PassSender teamPending={teamPending} registeredPending={regPending} />
    </div>
  );
}
