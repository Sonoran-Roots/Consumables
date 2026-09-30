"use client";

import { useState } from "react";
import PinPad from "./pin-pad";

// Pick-a-PIN-and-confirm-it, shared by new-kiosk-user sign-up and the
// "Forgot your PIN?" flow. Owns only the two entry steps; what happens with
// the confirmed PIN is up to the caller. onSubmit returns an error message to
// show (PIN taken, etc. — the person starts over at step one) or null on
// success, in which case the caller decides what comes next.
export default function PinCreate({
  firstName,
  disabled,
  onSubmit,
}: {
  firstName: string;
  disabled?: boolean;
  onSubmit: (pin: string) => Promise<string | null>;
}) {
  const [step, setStep] = useState<"pin1" | "pin2">("pin1");
  const [draft, setDraft] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function finish(pin: string) {
    setPending(true);
    const problem = await onSubmit(pin);
    setPending(false);
    if (problem) {
      setError(problem);
      setValue("");
      setDraft("");
      setStep("pin1");
    }
  }

  function handleChange(next: string) {
    setError(null);
    setValue(next);
    if (next.length < 4) return;

    if (step === "pin1") {
      setDraft(next);
      setValue("");
      setStep("pin2");
    } else if (next === draft) {
      void finish(next);
    } else {
      setError("PINs didn't match — try again.");
      setDraft("");
      setValue("");
      setStep("pin1");
    }
  }

  return (
    <PinPad
      title={step === "pin1" ? `Pick a 4-digit PIN, ${firstName}` : "Type it once more to confirm"}
      subtitle={
        step === "pin1"
          ? "It's yours alone — you'll enter it to log every checkout."
          : undefined
      }
      value={value}
      error={error}
      disabled={pending || disabled}
      onChange={handleChange}
    />
  );
}
