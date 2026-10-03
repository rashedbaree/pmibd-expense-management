import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { ticketTypeLabel } from "@/lib/checkin/attendees";

// Uses the same SMTP_* settings as the app's expense notifications
// (src/lib/email.ts) but its own transporter: pass emails carry an inline QR
// image and a Reply-To, and are sent in larger runs where a hung connection
// should fail fast rather than sit near the platform's function time limit.

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

export const smtpConfigured = () => getTransporter() !== null;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface PassDetails {
  organization?: string | null;
  designation?: string | null;
  type?: string | null;
  /** Team role (BOD, Volunteer, ...), set when this person is on the team. */
  role?: string | null;
}

const row = (label: string, value: string | null | undefined) =>
  value
    ? `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:4px 0;font-weight:600">${esc(value)}</td></tr>`
    : "";

/** The email body. Exported so it can be previewed without sending. */
export function buildPassHtml(
  name: string,
  ticket: string,
  details: PassDetails = {},
  note = "",
  isTeam = false,
) {
  const eventName = process.env.EVENT_NAME || "Bangladesh Project Management Symposium 2026";
  const typeLabel = ticketTypeLabel(details.type);

  const intro = isTeam
    ? `Thank you for being part of <b>${esc(eventName)}</b>${details.role ? ` as <b>${esc(details.role)}</b>` : ""}. This is your personal QR entry pass. Please show it at the registration booth.`
    : `Your registration for <b>${esc(eventName)}</b> is confirmed. Please show this QR code at the registration booth for quick check-in.`;

  const yourDetails = [
    row("Name", name),
    row("Organisation", details.organization),
    row("Designation", details.designation),
    row("Ticket type", typeLabel),
    row("Role", details.role),
    row("Ticket number", ticket),
  ].join("");

  const eventDetails = [
    row("Date", process.env.EVENT_DATE),
    row("Time", process.env.EVENT_TIME),
    row("Venue", process.env.EVENT_VENUE),
  ].join("");

  const noteBlock = note.trim()
    ? `<div style="margin:16px 0;padding:12px 14px;background:#fff7e6;border:1px solid #f0d9a8;border-radius:8px;font-size:14px">${esc(note.trim()).replace(/\r?\n/g, "<br>")}</div>`
    : "";

  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.45">
  <p>Dear ${esc(name)},</p>
  <p>${intro}</p>
  ${noteBlock}
  <div style="text-align:center;margin:24px 0">
    <img src="cid:entryqr" alt="Entry QR code" width="240" height="240" style="border:1px solid #ddd;border-radius:8px">
    <div style="font-family:monospace;font-size:14px;margin-top:8px">${esc(ticket)}</div>
  </div>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:12px">
    <tr><td colspan="2" style="padding:0 0 4px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#888">Your details</td></tr>
    ${yourDetails}
  </table>
  ${
    eventDetails
      ? `<table style="border-collapse:collapse;font-size:14px;margin-bottom:12px">
    <tr><td colspan="2" style="padding:0 0 4px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#888">Event details</td></tr>
    ${eventDetails}
  </table>`
      : ""
  }
  <p style="font-size:14px;color:#444">Tip: open this email on your phone and turn the screen brightness up, or bring a printout. If you can't find it on the day, no problem — just give your name at the booth.</p>
  <p>Regards,<br>PMI Bangladesh Chapter</p>
</div>`;
}

/** Throws on failure so the caller can record which recipient failed. */
export async function sendPassEmail(
  to: string,
  name: string,
  ticket: string,
  details: PassDetails = {},
  note = "",
  isTeam = false,
) {
  const t = getTransporter();
  if (!t) throw new Error("SMTP is not configured (SMTP_HOST/PORT/USER/PASSWORD).");

  const eventName = process.env.EVENT_NAME || "Bangladesh Project Management Symposium 2026";
  const png = await QRCode.toBuffer(ticket, {
    width: 480,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    // Whatever actually sends the mail, replies should land in the chapter's
    // own inbox, not whichever mailbox/service is doing the sending.
    replyTo: process.env.REPLY_TO || "info@pmibdchapter.org",
    to,
    subject: `Your entry pass – ${eventName}`,
    html: buildPassHtml(name, ticket, details, note, isTeam),
    attachments: [
      { filename: `${ticket}.png`, content: png, cid: "entryqr", contentType: "image/png" },
    ],
  });
}
