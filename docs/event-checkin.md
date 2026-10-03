# Event check in

QR check-in and gift-bag hand-out for chapter events, under **Event check in**
in the main menu. **Administrators only** - enforced in the database (RLS on
the `checkin_*` tables uses `is_admin()`), in every server action and API
route, and by hiding the menu item. Everyone running the booth signs in with
their own admin account; their name is recorded against each check-in.

Built for the Bangladesh Project Management Symposium 2026 (26 Sept) as a
standalone app, then folded into this one.

## What's there

| Page | Purpose |
|---|---|
| Scan: Check-in / Gift bag | Camera or USB/Bluetooth scanner. Green = welcome, amber = already done, red = not found. Gift bag also checks the person in. "Wrong person? Undo" on the result screen. Typing just the last 3-4 digits of a ticket shows who it is for a confirm tap. |
| Search attendee | Find by name, phone, email, organisation or ticket. Check in, give a bag, or Undo. The fallback when someone can't find their QR email. |
| Add walk-in | Someone not registered online. Checked in immediately, counted separately. |
| Live counter | Checked in vs expected, by ticket type, latest check-ins. Refreshes every 5 s. |
| Import registrations | Upload the registration system's `.xlsx`. Only `Status = Paid` rows. Safe to repeat. |
| Team members | Paste `Name, email, role` lines (BOD, volunteers...). Someone who is also a paid registrant keeps their real ticket and is just flagged as team. |
| Email QR passes | Each person's personal QR by email. Send to Team / Registered / Everyone, in chunks. |
| Backup list | A-Z printable list with tick boxes, for when the internet fails. |
| Download attendance | Excel of check-ins, bags and who has been emailed a pass. |
| Reset test data | Clears check-ins, bags, walk-ins and the scan log after a trial run. Never during the event. |

## Tables

`checkin_attendees` and `checkin_scan_log`, created by
`supabase/migrations/0016_event_checkin.sql`. The QR code contains the
attendee's `ticket_number`.

## Setting it up on a database

1. Run `0016_event_checkin.sql` in the Supabase SQL Editor.
2. To bring over data from the original standalone app's tables, use
   `scripts/migrate-checkin-dev-to-prod.js` (dry run first; see its header).

Email uses the same `SMTP_*` variables as expense notifications. Optional:
`EVENT_NAME`, `EVENT_DATE`, `EVENT_TIME`, `EVENT_VENUE` (shown in the pass
email) and `REPLY_TO` (defaults to `info@pmibdchapter.org`).

## Running an event - lessons from the first one

- **Import the final list, then send passes.** Re-importing is always safe for
  existing check-ins. The "not in this file" warning only means something when
  the file is the *complete* list: if you upload just the latest additions,
  ignore it and don't click Remove.
- **Send passes in chunks** (the page defaults to 50 at a time). Gmail blocks
  an account that logs in too often ("Too many login attempts"); fewer, bigger
  batches with a pause between them avoids it. Gmail's cap is 500 recipients
  a day.
- **Many people won't find their QR email** (spam folders). Search by name was
  what carried the booth on the day, so keep it as a first-class path, not a
  fallback.
- **Combine check-in and bag in one scan** by using the Gift bag station.
- **A group booking** (one email for several tickets) correctly sends each
  ticket its own email; the scan shows a "same email already checked in" note
  for the 2nd, 3rd... person. Informational only.
- **Undo** fixes one person's mistake. Reset wipes everyone's - trial runs only.
- **Free-tier mail services** (Brevo etc.) showed a sender address on their
  own domain unless the chapter's domain DNS was authenticated; sending from
  `info@pmibdchapter.org` needs either SMTP AUTH enabled on that Microsoft 365
  mailbox or the DNS records added.
