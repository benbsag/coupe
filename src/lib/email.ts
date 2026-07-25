interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends via Resend, or — in local dev with no RESEND_API_KEY — prints to
 * the server console instead, so every flow that sends mail keeps working
 * without a Resend account.
 */
export async function sendMail({ to, subject, text }: SendMailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[coupe] email to ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Coupe <coupe@localhost>",
    to,
    subject,
    text,
  });
  if (error) {
    throw new Error(`Resend failed to send mail: ${error.message}`);
  }
}
