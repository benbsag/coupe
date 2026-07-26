interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends via Gmail SMTP (authenticated with an app password), or — in local
 * dev with no GMAIL_USER/GMAIL_APP_PASSWORD — prints to the server console
 * instead, so every flow that sends mail keeps working without credentials.
 *
 * Mail is signed by Google's own DKIM, so it passes SPF/DKIM and delivers
 * reliably to Gmail and iCloud alike — unlike an unauthenticated sandbox.
 *
 * GMAIL_USER          — the full Gmail address that sends (e.g. you@gmail.com)
 * GMAIL_APP_PASSWORD  — a 16-char app password (Google Account → Security →
 *                       App passwords; requires 2-Step Verification). Spaces
 *                       are ignored, so it's fine to paste it as shown.
 * EMAIL_FROM          — optional From header; must be the GMAIL_USER address
 *                       (Gmail rejects sending as anyone else). Defaults to it.
 */
export async function sendMail({ to, subject, text }: SendMailInput): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !pass) {
    console.log(`\n[coupe] email to ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? `Coupe <${user}>`,
    to,
    subject,
    text,
  });
}
