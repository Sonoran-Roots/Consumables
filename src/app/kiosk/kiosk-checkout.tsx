"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { logKioskCheckout, confirmKioskPin, approveKioskPinReset } from "../checkouts/actions";
import {
  ChevronDownIcon,
  SearchIcon,
  UserIcon,
  CheckCircleIcon,
  XIcon,
} from "@/components/icons";
import PinPad from "./pin-pad";

type Site = { id: string; name: string };
type Employee = { id: string; name: string; hasPin: boolean };
type Item = { id: string; name: string; sku: string | null };
type CartLine = { itemId: string; name: string; quantity: number };
type PinPhase = "verify" | "create-step1" | "create-step2" | null;

const SITE_KEY = "kiosk-site-id";

export default function KioskCheckout({
  sites,
  employees,
  items,
}: {
  sites: Site[];
  employees: Employee[];
  items: Item[];
}) {
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteLoaded, setSiteLoaded] = useState(false);
  const [isReturn, setIsReturn] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [state, formAction, pending] = useActionState(logKioskCheckout, null);

  // PIN verifies who's actually checking out on this shared, location-signed
  // tablet — see confirmKioskPin. confirmedPin is only set once the server
  // has verified (or, first use, created) it; nothing below the PIN step
  // shows until then.
  const [pinPhase, setPinPhase] = useState<PinPhase>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinPending, setPinPending] = useState(false);
  const [confirmedPin, setConfirmedPin] = useState<string | null>(null);

  // A MANAGER/ADMIN employee can clear a coworker's forgotten PIN right
  // here — approveKioskPinReset — instead of someone needing the desktop
  // app. Entirely separate identity/PIN state from the target employee's
  // own, since it's a different person entering a different PIN.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [approverId, setApproverId] = useState<string | null>(null);
  const [approverPinValue, setApproverPinValue] = useState("");
  const [approverPinError, setApproverPinError] = useState<string | null>(null);
  const [approverPending, setApproverPending] = useState(false);

  // Remembered per-device — a kiosk tablet lives at one site, so staff
  // shouldn't have to repick it before every checkout.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SITE_KEY);
      if (saved && sites.some((s) => s.id === saved)) setSiteId(saved);
    } catch {
      // ignore — per-viewer convenience only
    }
    setSiteLoaded(true);
  }, [sites]);

  function chooseSite(id: string) {
    setSiteId(id);
    try {
      localStorage.setItem(SITE_KEY, id);
    } catch {
      // ignore
    }
  }

  function changeSite() {
    setSiteId(null);
    try {
      localStorage.removeItem(SITE_KEY);
    } catch {
      // ignore
    }
  }

  // Reset for the next person the moment a checkout logs successfully —
  // this tablet is shared, so nothing should carry over between checkouts.
  useEffect(() => {
    if (state?.success) {
      setCart([]);
      setEmployeeId(null);
      setQuery("");
      setConfirmedPin(null);
      setPinPhase(null);
      setPinValue("");
      setPinDraft("");
      setPinError(null);
      closeForgotFlow();
    }
  }, [state]);

  function closeForgotFlow() {
    setForgotOpen(false);
    setApproverId(null);
    setApproverPinValue("");
    setApproverPinError(null);
  }

  function selectEmployee(id: string) {
    setEmployeeId(id || null);
    setConfirmedPin(null);
    setPinValue("");
    setPinDraft("");
    setPinError(null);
    closeForgotFlow();
    const employee = employees.find((e) => e.id === id);
    setPinPhase(id ? (employee?.hasPin ? "verify" : "create-step1") : null);
  }

  async function submitApproverPin(pin: string) {
    if (!employeeId || !approverId) return;
    setApproverPending(true);
    const result = await approveKioskPinReset(employeeId, approverId, pin);
    setApproverPending(false);
    if (result.ok) {
      closeForgotFlow();
      setPinPhase("create-step1");
      setPinValue("");
      setPinDraft("");
      setPinError(null);
    } else {
      setApproverPinError(result.error);
      setApproverPinValue("");
    }
  }

  function handleApproverPinChange(next: string) {
    setApproverPinError(null);
    setApproverPinValue(next);
    if (next.length === 4) void submitApproverPin(next);
  }

  async function confirmPin(pin: string) {
    if (!employeeId) return;
    setPinPending(true);
    const result = await confirmKioskPin(employeeId, pin);
    setPinPending(false);
    if (result.ok) {
      setConfirmedPin(pin);
      setPinPhase(null);
      setPinValue("");
    } else {
      setPinError(result.error);
      setPinValue("");
      if (pinPhase === "create-step2") {
        setPinPhase("create-step1");
        setPinDraft("");
      }
    }
  }

  function handlePinChange(next: string) {
    setPinError(null);
    setPinValue(next);
    if (next.length < 4) return;

    if (pinPhase === "verify") {
      void confirmPin(next);
    } else if (pinPhase === "create-step1") {
      setPinDraft(next);
      setPinPhase("create-step2");
      setPinValue("");
    } else if (pinPhase === "create-step2") {
      if (next === pinDraft) {
        void confirmPin(next);
      } else {
        setPinError("PINs didn't match — try again.");
        setPinPhase("create-step1");
        setPinDraft("");
        setPinValue("");
      }
    }
  }

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, items]);

  function addItem(item: Item) {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { itemId: item.id, name: item.name, quantity: 1 }];
    });
    setQuery("");
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(itemId: string) {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  if (!siteLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-gray-400">
        Loading…
      </div>
    );
  }

  if (!siteId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-white p-6">
        <div className="text-center">
          <div className="text-2xl font-black tracking-tight text-black">
            JARS Cannabis Arizona
          </div>
          <div className="text-xs font-semibold tracking-[0.2em] text-gray-500">
            CONSUMABLE MANAGEMENT
          </div>
        </div>
        <div className="w-full max-w-md">
          <h1 className="mb-4 text-center text-xl font-semibold text-gray-900">
            Which site is this?
          </h1>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sites.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => chooseSite(s.id)}
                className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-lg font-medium text-gray-900 shadow-sm transition-colors active:bg-[#eef6f0]"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const site = sites.find((s) => s.id === siteId);
  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const identityConfirmed = !!employeeId && !!confirmedPin;
  const canSubmit = identityConfirmed && cart.length > 0 && !pending;
  const totalUnits = cart.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex shrink-0 items-center justify-between bg-black px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-tight text-white">JARS</span>
          <button
            type="button"
            onClick={changeSite}
            className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/20 hover:text-white"
          >
            {site?.name} · change
          </button>
        </div>
        <div className="flex overflow-hidden rounded-full bg-white/10 p-0.5">
          <button
            type="button"
            onClick={() => setIsReturn(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !isReturn ? "bg-white text-black" : "text-white/70"
            }`}
          >
            Check out
          </button>
          <button
            type="button"
            onClick={() => setIsReturn(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isReturn ? "bg-white text-black" : "text-white/70"
            }`}
          >
            Return
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-48">
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label
            htmlFor="kiosk-employee"
            className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700"
          >
            <UserIcon className="h-4 w-4 text-gray-400" />
            Who&apos;s this?
          </label>
          <div className="relative">
            <select
              id="kiosk-employee"
              value={employeeId ?? ""}
              onChange={(e) => selectEmployee(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-3 pl-4 pr-10 text-lg text-gray-900"
            >
              <option value="" disabled>
                Select your name…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {pinPhase && employeeId && !forgotOpen && (
          <div className="mb-4">
            <PinPad
              title={
                pinPhase === "verify"
                  ? `Enter PIN for ${selectedEmployee?.name}`
                  : pinPhase === "create-step1"
                    ? `Create a PIN for ${selectedEmployee?.name}`
                    : "Confirm your PIN"
              }
              subtitle={
                pinPhase === "create-step1"
                  ? "You'll use this 4-digit PIN each time you check out items."
                  : undefined
              }
              value={pinValue}
              error={pinError}
              disabled={pinPending}
              onChange={handlePinChange}
            />
            {pinPhase === "verify" && (
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="mt-3 block w-full text-center text-sm text-gray-500 hover:text-gray-800 hover:underline"
              >
                Forgot your PIN? Ask a manager
              </button>
            )}
          </div>
        )}

        {forgotOpen && employeeId && (
          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-center text-base font-medium text-gray-900">
              Reset PIN for {selectedEmployee?.name}
            </p>
            <p className="mt-0.5 text-center text-sm text-gray-500">
              A manager or admin enters their own PIN to approve this.
            </p>

            <div className="relative mt-4">
              <select
                value={approverId ?? ""}
                onChange={(e) => {
                  setApproverId(e.target.value || null);
                  setApproverPinValue("");
                  setApproverPinError(null);
                }}
                className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-3 pl-4 pr-10 text-lg text-gray-900"
              >
                <option value="" disabled>
                  Which manager is approving this?
                </option>
                {employees
                  .filter((e) => e.id !== employeeId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>

            {approverId && (
              <div className="mt-4">
                <PinPad
                  title={`Enter PIN for ${employees.find((e) => e.id === approverId)?.name}`}
                  value={approverPinValue}
                  error={approverPinError}
                  disabled={approverPending}
                  onChange={handleApproverPinChange}
                />
              </div>
            )}

            <button
              type="button"
              onClick={closeForgotFlow}
              className="mt-3 block w-full text-center text-sm text-gray-500 hover:text-gray-800 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        {!employeeId && (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
            <UserIcon className="h-8 w-8" />
            <p>Pick who this is to get started.</p>
          </div>
        )}

        {identityConfirmed && (
          <>
            <div className="relative mb-4">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search item…"
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-lg shadow-sm"
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left last:border-0 active:bg-[#eef6f0]"
                    >
                      <span className="text-base text-gray-900">{item.name}</span>
                      {item.sku && (
                        <span className="ml-3 shrink-0 font-mono text-xs text-gray-400">
                          {item.sku}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {cart.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                  <SearchIcon className="h-8 w-8" />
                  <p>Search above to add items.</p>
                </div>
              )}
              {cart.length > 0 && (
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {cart.length} item{cart.length === 1 ? "" : "s"} · {totalUnits} unit
                  {totalUnits === 1 ? "" : "s"}
                </p>
              )}
              {cart.map((line) => (
                <div
                  key={line.itemId}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <span className="flex-1 text-base text-gray-900">{line.name}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(line.itemId, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-medium text-gray-700 active:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-medium tabular-nums">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(line.itemId, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-medium text-gray-700 active:bg-gray-200"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(line.itemId)}
                    className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 active:bg-gray-100 active:text-red-600"
                    title="Remove"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {state?.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#eef6f0] px-4 py-3 text-sm text-[#134229]">
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
            Logged {state.itemCount} item{state.itemCount === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      <form
        action={formAction}
        className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4"
      >
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="employeeId" value={employeeId ?? ""} />
        <input type="hidden" name="pin" value={confirmedPin ?? ""} />
        <input type="hidden" name="isReturn" value={String(isReturn)} />
        {cart.map((line) => (
          <span key={line.itemId}>
            <input type="hidden" name="itemId" value={line.itemId} />
            <input type="hidden" name="quantity" value={line.quantity} />
          </span>
        ))}
        {!canSubmit && !pending && (
          <p className="mb-2 text-center text-xs text-gray-400">
            {!employeeId
              ? "Pick who this is for."
              : !confirmedPin
                ? "Confirm your PIN above."
                : "Add at least one item."}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl border border-black bg-black py-4 text-lg font-semibold text-white transition-colors hover:bg-white hover:text-black disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {pending
            ? "Logging…"
            : isReturn
              ? `Log return (${cart.length})`
              : `Log checkout (${cart.length})`}
        </button>
      </form>
    </div>
  );
}
