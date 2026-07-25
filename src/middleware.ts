import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // /api/cron/* guards itself with CRON_SECRET (see route.ts) — it must
  // stay reachable without a user session, since Vercel Cron calls it with
  // no cookie at all.
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
