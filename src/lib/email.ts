import nodemailer from "nodemailer";

// Separate from Supabase's own SMTP config (Authentication > Emails), which
// only Supabase Auth itself can use for its own templates (password reset,
// etc.) - this app needs its own sender for business notifications like
// "an expense needs your approval". Reuses the same Gmail account/App
// Password already set up there, via its own env vars.

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
  });
  return transporter;
}

export async function sendMail(to: string[], subject: string, html: string) {
  if (to.length === 0) return;

  const t = getTransporter();
  if (!t) {
    console.warn(
      `sendMail skipped ("${subject}" to ${to.join(", ")}): SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD not configured.`,
    );
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await t.sendMail({ from, to, subject, html });
  } catch (error) {
    // Never let a notification failure break the action that triggered it.
    console.error(`sendMail failed ("${subject}" to ${to.join(", ")}):`, error);
  }
}
