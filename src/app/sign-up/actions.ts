"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { digestPin, PIN_PATTERN } from "@/lib/pin";
import { revalidatePath } from "next/cache";

export type RegisterResult = { ok: true } | { ok: false; error: string };

// One sign-up creates the whole person: the login AND the Employee that the
// kiosk knows them by, PIN included. There is deliberately no separate
// "now make a kiosk user" step afterwards — an app user and a kiosk user are
// the same identity, so the PIN is collected here and used both to check out
// at any kiosk and (via Employee.userId) to tie their desktop login to the
// same person on every log.
//
// Ticking "shared tablet" skips the Employee/PIN half: those accounts are
// the location-signed-in logins a kiosk tablet sits on, not people. People
// then self-register on that tablet (createKioskUser).
//
// Dashboard access is NOT granted here — Better Auth's role/isPurchasingTeam
// stay at their defaults (input: false), so a new account lands on /kiosk
// until an admin turns on "Purchasing team" for it on the Employees page.
export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  pin: string;
  sharedTablet: boolean;
}): Promise<RegisterResult> {
  const name = input.name.replace(/\s+/g, " ").trim();
  const email = input.email.trim();

  if (name.length < 2) return { ok: false, error: "Enter your full name." };
  if (name.length > 60) return { ok: false, error: "That name is too long." };

  if (!input.sharedTablet) {
    if (!PIN_PATTERN.test(input.pin)) return { ok: false, error: "PIN must be 4 digits." };

    const [pinTaken, nameTaken] = await Promise.all([
      db.employee.findUnique({ where: { pinDigest: digestPin(input.pin) }, select: { id: true } }),
      db.employee.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, isActive: true },
        select: { id: true },
      }),
    ]);
    if (pinTaken) {
      return { ok: false, error: "That PIN is already taken by someone else — pick a different one." };
    }
    if (nameTaken) {
      return {
        ok: false,
        error:
          "An employee with that name already exists. Ask an admin to give that employee app access instead of creating a second one.",
      };
    }
  }

  let userId: string;
  try {
    // nextCookies() on the auth instance sets the session cookie from here,
    // so they're signed in the moment this returns.
    const result = await auth.api.signUpEmail({
      body: { email, password: input.password, name },
    });
    userId = result.user.id;
  } catch (e) {
    const message =
      (e as { body?: { message?: string } })?.body?.message ??
      (e as Error).message ??
      "Couldn't create that account.";
    return { ok: false, error: message };
  }

  if (!input.sharedTablet) {
    try {
      await db.employee.create({
        data: { name, userId, pinDigest: digestPin(input.pin) },
      });
    } catch (e) {
      // Lost a race for the same PIN/name — don't leave a half-made person
      // (a login with no kiosk identity) behind.
      await db.user.delete({ where: { id: userId } }).catch(() => {});
      if ((e as { code?: string }).code === "P2002") {
        return { ok: false, error: "That PIN was just taken — pick a different one." };
      }
      throw e;
    }
  }

  revalidatePath("/employees");
  return { ok: true };
}
