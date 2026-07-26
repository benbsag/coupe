interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends via Mailgun's HTTP API, or — in local dev with no MAILGUN_API_KEY —
 * prints to the server console instead, so every flow that sends mail keeps
 * working without a Mailgun account.
 *
 * Uses a plain fetch (no SDK dependency). On Mailgun's free sandbox domain
 * you can only deliver to "authorized recipients" you've added in the
 * dashboard — fine for an invite-only two-person app.
 *
 * MAILGUN_API_KEY   — private API key from the Mailgun dashboard
 * MAILGUN_DOMAIN    — sending domain, e.g. sandbox1234abcd.mailgun.org
 * MAILGUN_API_BASE  — optional; set to https://api.eu.mailgun.net for the EU
 *                     region (defaults to the US region)
 * EMAIL_FROM        — From header; must be an address on MAILGUN_DOMAIN
 */
export async function sendMail({ to, subject, text }: SendMailInput): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;

  if (!apiKey || !domain) {
    console.log(`\n[coupe] email to ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  const base = process.env.MAILGUN_API_BASE ?? "https://api.mailgun.net";
  const body = new URLSearchParams({
    from: process.env.EMAIL_FROM ?? `Coupe <postmaster@${domain}>`,
    to,
    subject,
    text,
  });

  const res = await fetch(`${base}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Mailgun failed to send mail (${res.status}): ${detail}`);
  }
}
