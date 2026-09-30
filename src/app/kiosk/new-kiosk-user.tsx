"use client";

import { useState } from "react";
import { createKioskUser } from "../checkouts/actions";
import PinCreate from "./pin-create";

// New-person self-signup at the kiosk: name, then a PIN entered twice. The
// PIN must be unique across everyone (it's how the kiosk knows who's who), so
// the server may bounce it. onCreated hands back the new employee; they don't
// need to identify themselves again until they actually log a checkout.
export default function NewKioskUser({
  siteId,
  siteName,
  onCreated,
  onCancel,
}: {
  siteId: string | null;
  siteName?: string;
  onCreated: (employee: { id: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"name" | "pin">("name");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    setError(null);
    setStep("pin");
  }

  async function createUser(pin: string): Promise<string | null> {
    const result = await createKioskUser(name, pin, siteId);
    if (result.ok) {
      onCreated(result.employee);
      return null;
    }
    // A name problem needs the name field back; a PIN problem (taken) stays
    // on the PIN pad so they can try another.
    if (/name|list/i.test(result.error)) {
      setError(result.error);
      setStep("name");
      return null;
    }
    return result.error;
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
        <PinCreate firstName={name.trim().split(" ")[0]} onSubmit={createUser} />
      )}

      <button
        type="button"
        onClick={onCancel}
        className="block w-full text-center text-sm text-gray-500 hover:text-gray-800 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
