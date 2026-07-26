import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the auth config: no adapter, no providers that touch
 * Postgres. Middleware runs on the Edge runtime by default and can't load
 * `pg` (needs Node core modules like node:util/types) — so it only gets
 * this config, while auth.ts (Node runtime: route handlers, server
 * components) gets the full one built on top of it.
 */
export const authConfig: NextAuthConfig = {
  // Must live here (not only in auth.ts): middleware builds its own Auth.js
  // instance from this edge config, and without trustHost it throws
  // UntrustedHost on Vercel -> MIDDLEWARE_INVOCATION_FAILED.
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
    error: "/sign-in",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (request.nextUrl.pathname.startsWith("/sign-in")) return true;
      return !!auth?.user;
    },
  },
};
