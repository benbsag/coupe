import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { authConfig } from "@/auth.config";
import { CoupeAdapter } from "@/lib/auth-adapter";

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
    Resend({
      apiKey: process.env.RESEND_API_KEY || "dev-no-key",
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        if (!process.env.RESEND_API_KEY) {
          // Local dev without a Resend key: print the magic link instead of
          // sending mail, so sign-in still works end to end.
          console.log(`\n[coupe] magic link for ${identifier}:\n${url}\n`);
          return;
        }
        const { Resend: ResendClient } = await import("resend");
        const resend = new ResendClient(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "Coupe <coupe@localhost>",
          to: identifier,
          subject: "Sign in to Coupe",
          text: `Sign in to Coupe: ${url}\n\nThis link expires shortly and can only be used once.`,
        });
        if (error) {
          throw new Error(`Resend failed to send magic link: ${error.message}`);
        }
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
