import { ticketTypeLabel, type PublicAttendee } from "@/lib/checkin/attendees";

/** Big, glanceable attendee details used on scan results. */
export default function AttendeeCard({ a }: { a: PublicAttendee }) {
  const type = a.source === "walkin" ? a.ticket_type : ticketTypeLabel(a.ticket_type);
  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold leading-tight sm:text-4xl">{a.name}</div>
      {a.organization && (
        <div className="mt-2 text-lg opacity-90">{a.organization}</div>
      )}
      {a.designation && <div className="text-base opacity-75">{a.designation}</div>}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
        {type && (
          <span className="rounded-full bg-white/25 px-3 py-1 font-semibold">{type}</span>
        )}
        <span className="rounded-full bg-white/25 px-3 py-1 font-mono">
          {a.ticket_number}
        </span>
      </div>
    </div>
  );
}
