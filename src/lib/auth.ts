import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

// Interim login layer while Entra ID isn't wired up yet — see the Auth
// schema block in prisma/schema.prisma.
//
// Sign-up is temporarily open ONLY to bootstrap the first account(s) at
// /sign-up. Once real accounts exist, flip disableSignUp to true and
// delete src/app/sign-up/ — there's no self-serve registration need for
// an internal tool, and leaving it open is an open door on a public URL.
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
  },
  // Better Auth only trusts baseURL's own origin (BETTER_AUTH_URL) by
  // default — every other origin gets rejected as "Invalid origin",
  // including Vercel's own per-deployment preview URLs (each deploy gets
  // a unique *.vercel.app hostname distinct from the stable production
  // alias). VERCEL_URL is set automatically by Vercel to whichever
  // deployment is currently serving the request, so this trusts that one
  // too without hardcoding anything.
  trustedOrigins: process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [],
  user: {
    additionalFields: {
      // input: false — never settable by the account holder (sign-up or
      // otherwise), only by an admin via /users. See prisma/schema.prisma's
      // StaffRole/User comments for what these actually gate.
      role: { type: "string", defaultValue: "USER", input: false, required: false },
      isPurchasingTeam: { type: "boolean", defaultValue: false, input: false, required: false },
      // Inventory Audit module access (null = none). Same rule: admin-set only.
      auditRole: { type: "string", input: false, required: false },
    },
  },
  session: {
    // src/proxy.ts reads role/isPurchasingTeam from this signed cookie on
    // every request to decide access — without caching, that would mean a
    // full DB round trip per navigation. A stale cache (up to 5 min) just
    // means a just-changed role takes a few minutes to take effect, which
    // is an acceptable trade for not hitting the DB on every page load.
    cookieCache: { enabled: true },
  },
  plugins: [nextCookies()],
});
