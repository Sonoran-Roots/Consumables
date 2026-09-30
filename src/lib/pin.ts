import { createHmac } from "node:crypto";

// Keyed digest of a kiosk PIN, stored as Employee.pinDigest. Deterministic on
// purpose: the kiosk identifies who's checking out from the PIN alone, so the
// stored value has to be directly comparable/lookup-able (and unique-indexed),
// which a per-row salted hash can't be. Keyed with the server secret so a
// leaked database alone doesn't hand over the (tiny, 10k-value) PIN space.
export function digestPin(pin: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`kiosk-pin:${pin}`).digest("hex");
}

export const PIN_PATTERN = /^\d{4}$/;
