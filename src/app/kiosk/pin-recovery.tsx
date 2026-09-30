"use client";

import { useState } from "react";
import { approveKioskPinReset, setKioskPin } from "../checkouts/actions";
import { ChevronDownIcon } from "@/components/icons";
import PinPad from "./pin-pad";
import PinCreate from "./pin-create";

type Person = { id: string; name: string; hasPin: boolean };

// "Forgot your PIN?" — the one place on the kiosk where you pick your name,
// because the PIN can't identify you when it's the thing you've lost.
//   • No PIN on file yet (added by an admin, or cleared) → set one straight away.
//   • PIN on file → a manager or admin enters THEIR OWN PIN to approve
//     clearing it (their PIN identifies them; no picker), then you set a new one.
export default function PinRecovery({
  people,
  onDone,
  onCancel,
}: {
  people: Person[];
  onDone: (personName: string) => void;
  onCancel: () => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [approverPin, setApproverPin] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approvePending, setApprovePending] = useState(false);

  const target = people.find((p) => p.id === targetId);
  const needsApproval = !!target?.hasPin && !approved;

  async function handleApproverPin(next: string) {
    setApproveError(null);
    setApproverPin(next);
    if (next.length < 4 || !targetId) return;
    setApprovePending(true);
    const result = await approveKioskPinReset(targetId, next);
    setApprovePending(false);
    if (result.ok) {
      setApproved(true);
    } else {
      setApproveError(result.error);
      setApproverPin("");
    }
  }

  async function saveNewPin(pin: string): Promise<string | null> {
    if (!target) return "Pick who this is first.";
    const result = await setKioskPin(target.id, pin);
    if (result.ok) {
      onDone(target.name);
      return null;
    }
    return result.error;
  }

  return (
    <div className="mb-4 space-y-3">
      {!target && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-center text-base font-medium text-gray-900">Forgot your PIN?</p>
          <p className="mt-0.5 text-center text-sm text-gray-500">Find your name to get a new one.</p>
          <div className="relative mt-4">
            <select
              value=""
              onChange={(e) => e.target.value && setTargetId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-3 pl-4 pr-10 text-lg text-gray-900"
            >
              <option value="" disabled>
                Select your name…
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      )}

      {target && needsApproval && (
        <PinPad
          title={`Manager approval for ${target.name}`}
          subtitle="A manager or admin enters their own PIN to clear this PIN."
          value={approverPin}
          error={approveError}
          disabled={approvePending}
          onChange={handleApproverPin}
        />
      )}

      {target && !needsApproval && (
        <PinCreate firstName={target.name.split(" ")[0]} onSubmit={saveNewPin} />
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
