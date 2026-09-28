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
  plugins: [nextCookies()],
});
