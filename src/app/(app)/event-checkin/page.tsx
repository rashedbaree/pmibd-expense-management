import Link from "next/link";

const EVENT_DAY = [
  { href: "/event-checkin/scan?mode=checkin", title: "Scan: Check-in", note: "Registration booth" },
  { href: "/event-checkin/scan?mode=bag", title: "Scan: Gift bag", note: "Hands over the bag and checks the person in too" },
  { href: "/event-checkin/search", title: "Search attendee", note: "No QR? Find by name, phone, email" },
  { href: "/event-checkin/walkin", title: "Add walk-in", note: "Not registered online" },
  { href: "/event-checkin/stats", title: "Live counter", note: "Checked in vs expected" },
];

const SETUP = [
  { href: "/event-checkin/import", title: "Import registrations", note: "Upload the Excel export" },
  { href: "/event-checkin/team", title: "Team members", note: "Add BOD & volunteers, give them a pass" },
  { href: "/event-checkin/passes", title: "Email QR passes", note: "Send passes to team or attendees" },
  { href: "/event-checkin/list", title: "Backup list", note: "Paper list if the internet fails" },
  { href: "/event-checkin/export", title: "Download attendance", note: "Excel of check-ins, bags and passes sent" },
  { href: "/event-checkin/reset", title: "Reset test data", note: "After a trial run, before the event" },
];

export default function EventCheckinHome() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Event check in
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        QR check-in and gift-bag hand-out for chapter events. Administrators
        only: everyone running the booth signs in with their own admin account.
      </p>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EVENT_DAY.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg bg-brand px-5 py-4 text-white hover:bg-brand/90"
          >
            <p className="text-lg font-semibold">{t.title}</p>
            <p className="text-sm text-white/80">{t.note}</p>
          </Link>
        ))}
      </section>

      <h2 className="mt-8 mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Set-up &amp; records
      </h2>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SETUP.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            // The export is a file download, not a page: skip client routing.
            prefetch={t.href === "/event-checkin/export" ? false : undefined}
            className="rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <p className="font-medium text-zinc-950 dark:text-zinc-50">{t.title}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.note}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
