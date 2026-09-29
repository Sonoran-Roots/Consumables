"use client";

import { useState } from "react";
import { createKioskUser } from "../checkouts/actions";
import PinPad from "./pin-pad";

type Step = "name" | "pin1" | "pin2";

// New-employee self-signup at the kiosk: name, then a PIN entered twice.
// Owns its own step state so the main kiosk screen only has to know "open"
// and "done" — onCreated hands back the new employee plus the PIN they just
// set, which the kiosk treats as already-confirmed identity (they literally
// just proved it).
export default function NewKioskUser({
  siteId,
  siteName,
  onCreated,
  onCancel,
}: {
  siteId: string | null;
  siteName?: string;
  onCreated: (employee: { id: string; name: string }, pin: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    setError(null);
    setStep("pin1");
  }

  async function finish(pin: string) {
    setPending(true);
    const result = await createKioskUser(name, pin, siteId);
    setPending(false);
    if (result.ok) {
      onCreated(result.employee, pin);
      return;
    }
    setError(result.error);
    setPinValue("");
    setDraft("");
    // A name problem needs the name field back; anything else, retry the PIN.
    setStep(/name|list/i.test(result.error) ? "name" : "pin1");
  }

  function handlePinChange(next: string) {
    setError(null);
    setPinValue(next);
    if (next.length < 4) return;

    if (step === "pin1") {
      setDraft(next);
      setPinValue("");
      setStep("pin2");
    } else if (step === "pin2") {
      if (next === draft) {
        void finish(next);
      } else {
        setError("PINs didn't match — try again.");
        setDraft("");
        setPinValue("");
        setStep("pin1");
      }
    }
  }

  return (
    <div className="mb-4 space-y-3">
      {step === "name" ? (
        <form
          onSubmit={submitName}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <p className="text-center text-base font-medium text-gray-900">
            Welcome{siteName ? ` to ${siteName}` : ""}! Let&apos;s set you up.
          </p>
          <p className="mt-0.5 text-center text-sm text-gray-500">
            What&apos;s your first and last name?
          </p>
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={60}
            autoComplete="off"
            placeholder="Full name"
            className="mt-4 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-lg text-gray-900"
          />
          {error && <p className="mt-3 text-center text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl border border-black bg-black py-3.5 text-lg font-semibold text-white transition-colors hover:bg-white hover:text-black"
          >
            Next — pick a PIN
          </button>
        </form>
      ) : (
        <PinPad
          title={step === "pin1" ? `Pick a 4-digit PIN, ${name.trim().split(" ")[0]}` : "Type it once more to confirm"}
          subtitle={
            step === "pin1" ? "You'll use this PIN every time you check out items." : undefined
          }
          value={pinValue}
          error={error}
          disabled={pending}
          onChange={handlePinChange}
        />
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="block w-full text-center text-sm text-gray-500 hover:text-gray-800 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
