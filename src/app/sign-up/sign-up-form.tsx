"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerAccount } from "./actions";

export default function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [sharedTablet, setSharedTablet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await registerAccount({ name, email, password, pin, sharedTablet });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {sharedTablet ? "Tablet name" : "Name"}
        </label>
        <input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={sharedTablet ? "e.g. Tempe Retail Kiosk" : "First and last name"}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
      </div>
      {!sharedTablet && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Kiosk PIN</label>
          <input
            required
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm tracking-[0.4em]"
          />
          <p className="mt-1 text-xs text-gray-500">
            4 digits, unique to you. It&apos;s how the kiosk knows who&apos;s checking out — same
            PIN on every tablet.
          </p>
        </div>
      )}
      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={sharedTablet}
          onChange={(e) => setSharedTablet(e.target.checked)}
          className="mt-0.5 rounded border-gray-300"
        />
        <span>
          This is a shared location tablet, not a person. Staff will add themselves on the tablet
          with their own PIN.
        </span>
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
