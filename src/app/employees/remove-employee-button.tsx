"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeEmployee } from "./actions";

export default function RemoveEmployeeButton({
  employeeId,
  employeeName,
  hasLogin,
}: {
  employeeId: string;
  employeeName: string;
  hasLogin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    const loginNote = hasLogin ? " Their login will be deleted." : "";
    if (
      !confirm(
        `Remove ${employeeName}?${loginNote} Their kiosk PIN will stop working, and past checkouts and transfers keep their name. This can't be undone.`
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await removeEmployee(employeeId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error && <span className="mr-2 text-xs text-red-700">{error}</span>}
      <button
        type="button"
        onClick={handleRemove}
        disabled={pending}
        className="ml-3 text-xs text-gray-400 hover:text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
    </>
  );
}
