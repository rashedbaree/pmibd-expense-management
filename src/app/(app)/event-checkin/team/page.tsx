import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import {
  ATTENDEES_TABLE,
  formatDateTime,
  ticketTypeLabel,
} from "@/lib/checkin/attendees";
import { TEAM_PREFIX } from "@/lib/checkin/team";
import TeamForm from "./form";
import { removeTeamMember } from "./actions";

interface Member {
  id: string;
  name: string;
  email: string | null;
  ticket_number: string;
  ticket_type: string | null;
  team_role: string | null;
  pass_emailed_at: string | null;
  checked_in_at: string | null;
}

export default async function TeamPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(ATTENDEES_TABLE)
    .select("id, name, email, ticket_number, ticket_type, team_role, pass_emailed_at, checked_in_at")
    .eq("is_team", true)
    .order("name")
    .limit(1000);
  if (error) throw new Error(error.message);
  const members = (data ?? []) as Member[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Team members
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          BOD members, volunteers, speakers and others who help run the event.
          Each gets a personal QR pass. If someone here is also a paid
          attendee, pasting their email keeps their real ticket instead of
          creating a second one. Pasting the same email again just updates
          the name or role.
        </p>
      </div>

      <TeamForm />

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          On the team ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-zinc-500">Nobody added yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {members.map((m) => {
              const isSynthetic = m.ticket_number.startsWith(TEAM_PREFIX);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-zinc-950 dark:text-zinc-50">
                      {m.name} <span className="font-normal text-zinc-500">· {m.team_role}</span>
                    </div>
                    <div className="truncate text-zinc-600 dark:text-zinc-400">
                      {m.email} · <span className="font-mono">{m.ticket_number}</span>
                    </div>
                    {!isSynthetic && (
                      <div className="text-xs text-emerald-700 dark:text-emerald-400">
                        Also a paid attendee ({ticketTypeLabel(m.ticket_type)})
                      </div>
                    )}
                    <div className="text-xs text-zinc-500">
                      {m.pass_emailed_at ? `Pass emailed ${formatDateTime(m.pass_emailed_at)}` : "Pass not sent yet"}
                      {m.checked_in_at ? ` · checked in ${formatDateTime(m.checked_in_at)}` : ""}
                    </div>
                  </div>
                  <form action={removeTeamMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmSubmitButton
                      confirmTitle={isSynthetic ? "Remove from team?" : "Take off the team?"}
                      confirmMessage={
                        isSynthetic
                          ? `Remove ${m.name}? They are not a registered attendee, so their record and pass are deleted.`
                          : `Take ${m.name} off the team? They stay in the system as a registered attendee.`
                      }
                      destructive
                      className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      {isSynthetic ? "Remove" : "Un-team"}
                    </ConfirmSubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
