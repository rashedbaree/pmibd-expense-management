import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import {
  fetchAllAttendees,
  ticketTypeLabel,
  type Attendee,
} from "@/lib/checkin/attendees";

export default async function BackupListPage() {
  const supabase = await createClient();
  const rows = await fetchAllAttendees<Attendee>(supabase, "*", "name");

  return (
    <div>
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <div className="print:hidden mb-4 space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Backup attendee list
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Print this and keep it at the booth ({rows.length} people, A to Z).
          If the Wi-Fi or the site goes down, tick people off by hand and
          enter them later.
        </p>
        <PrintButton />
      </div>

      <table className="w-full border-collapse text-[10pt]">
        <thead>
          <tr className="border-b-2 border-zinc-900 text-left dark:border-zinc-300 print:border-black">
            <th className="w-8 py-1">#</th>
            <th className="py-1">Name</th>
            <th className="py-1">Organisation</th>
            <th className="py-1">Type</th>
            <th className="py-1">Ticket</th>
            <th className="w-16 py-1 text-center">In</th>
            <th className="w-16 py-1 text-center">Bag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr
              key={a.id}
              className="border-b border-zinc-300 [break-inside:avoid] dark:border-zinc-700 print:border-zinc-400"
            >
              <td className="py-1 text-zinc-500">{i + 1}</td>
              <td className="py-1 font-semibold">{a.name}</td>
              <td className="py-1">{a.organization}</td>
              <td className="py-1">
                {a.source === "walkin" ? a.ticket_type : ticketTypeLabel(a.ticket_type)}
                {a.is_team ? ` · ${a.team_role ?? "Team"}` : ""}
              </td>
              <td className="py-1 font-mono text-[9pt]">{a.ticket_number}</td>
              <td className="py-1 text-center">{a.checked_in_at ? "✓" : "☐"}</td>
              <td className="py-1 text-center">{a.bag_given_at ? "✓" : "☐"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
