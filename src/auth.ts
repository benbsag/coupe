import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { authConfig } from "@/auth.config";
import { CoupeAdapter } from "@/lib/auth-adapter";
import { sendMail } from "@/lib/email";

const allowedEmails = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: CoupeAdapter(),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    // We use next-auth's Resend provider only as the magic-link plumbing
    // (token generation + the "resend" provider id). Actual delivery is fully
    // overridden by sendVerificationRequest below, which sends via Mailgun
    // (see src/lib/email.ts) — so apiKey here is an unused placeholder.
    Resend({
      apiKey: "unused-delivery-handled-by-sendmail",
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        await sendMail({
          to: identifier,
          subject: "Sign in to Coupe",
          text: `Sign in to Coupe: ${url}\n\nThis link expires shortly and can only be used once.`,
        });
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      return allowedEmails.has(user.email.toLowerCase());
    },
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
