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
  plugins: [nextCookies()],
});
