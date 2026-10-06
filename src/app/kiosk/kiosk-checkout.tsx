"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logKioskCheckout } from "../checkouts/actions";
import { ChevronDownIcon, SearchIcon, CheckCircleIcon, XIcon } from "@/components/icons";
import PinPad from "./pin-pad";
import NewKioskUser from "./new-kiosk-user";
import PinRecovery from "./pin-recovery";
import JarsLogo from "@/components/jars-logo";

type Site = { id: string; name: string };
type Person = { id: string; name: string; hasPin: boolean };
type Item = { id: string; name: string; sku: string | null };
type CartLine = { itemId: string; name: string; quantity: number };
type Panel = "signup" | "recovery" | null;

const SITE_KEY = "kiosk-site-id";
const MAX_QUANTITY = 999_999; // keep in step with KIOSK_MAX_QUANTITY in checkouts/actions.ts

// Tap the number to type an amount (numeric keypad on tablets) — for the times
// someone needs thousands of an item and tapping + isn't practical. While
// editing, an empty or zero entry is simply not applied, and the field shows
// the real quantity again once you leave it.
function QuantityInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null); // null = not editing
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label="Quantity"
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
        setDraft(digits);
        const n = Math.min(Number(digits), MAX_QUANTITY);
        if (n > 0) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
      className="w-24 rounded-lg border border-gray-200 bg-gray-50 py-1 text-center text-lg font-medium tabular-nums text-gray-900 focus:border-black focus:bg-white focus:outline-none"
    />
  );
}

export default function KioskCheckout({
  sites,
  people: serverPeople,
  items,
  adminHref,
}: {
  sites: Site[];
  people: Person[];
  items: Item[];
  adminHref: string | null; // null when this login has no access to the backend
}) {
  const router = useRouter();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteLoaded, setSiteLoaded] = useState(false);
  const [isReturn, setIsReturn] = useState(false);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  // People who signed themselves up on this tablet since the page loaded —
  // merged in right away so "Forgot your PIN?" can find them without a refetch.
  const [addedPeople, setAddedPeople] = useState<Person[]>([]);
  const people = useMemo(
    () =>
      [...serverPeople, ...addedPeople.filter((a) => !serverPeople.some((s) => s.id === a.id))].sort(
        (a, b) => a.name.localeCompare(b.name)
      ),
    [serverPeople, addedPeople]
  );

  // Sign-up and PIN recovery temporarily replace the checkout screen (the
  // cart stays put underneath, so nobody loses what they'd picked).
  const [panel, setPanel] = useState<Panel>(null);

  // The PIN step: there's no "who's this?" picker anywhere. Tapping "Log
  // checkout" opens this pad, and whoever's PIN gets entered is who the log
  // is assigned to (server-side lookup — see logKioskCheckout).
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinPending, setPinPending] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

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

  function closePin() {
    setPinOpen(false);
    setPinValue("");
    setPinError(null);
  }

  function openPanel(next: Panel) {
    closePin();
    setNotice(null);
    setPanel(next);
  }

  async function submitPin(pin: string) {
    if (!siteId) return;
    setPinPending(true);
    const result = await logKioskCheckout({
      siteId,
      isReturn,
      lines: cart.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
      pin,
    });
    setPinPending(false);

    if (!result.ok) {
      setPinError(result.error);
      setPinValue("");
      return;
    }

    // Reset for the next person the moment a checkout logs — this tablet is
    // shared, so nothing should carry over.
    setCart([]);
    setQuery("");
    closePin();
    setNotice(
      `${isReturn ? "Returned" : "Logged"} ${result.itemCount} item${
        result.itemCount === 1 ? "" : "s"
      } for ${result.employeeName}.`
    );
  }

  function handlePinChange(next: string) {
    setPinError(null);
    setPinValue(next);
    if (next.length === 4) void submitPin(next);
  }

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, items]);

  function addItem(item: Item) {
    setNotice(null);
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

  function setQty(itemId: string, quantity: number) {
    setCart((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)));
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
        <div className="flex flex-col items-center text-center">
          <JarsLogo size={112} className="mb-4" />
          <div className="text-2xl font-black tracking-tight text-black">
            JARS Cannabis Arizona
          </div>
          <div className="text-xs font-semibold tracking-[0.2em] text-gray-500">
            CONSUMABLE MANAGEMENT
          </div>
        </div>
        {adminHref && (
          <Link href={adminHref} className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Admin console
          </Link>
        )}
        <div className="w-full max-w-md">
          <label
            htmlFor="kiosk-site"
            className="mb-4 block text-center text-xl font-semibold text-gray-900"
          >
            Which site is this?
          </label>
          <div className="relative">
            <select
              id="kiosk-site"
              value=""
              onChange={(e) => e.target.value && chooseSite(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-4 pl-4 pr-10 text-lg text-gray-900 shadow-sm"
            >
              <option value="" disabled>
                Select a location…
              </option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  const site = sites.find((s) => s.id === siteId);
  const totalUnits = cart.reduce((sum, l) => sum + l.quantity, 0);
  const actionLabel = isReturn ? "return" : "checkout";

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
        <div className="flex items-center gap-3">
        {adminHref && (
          <Link href={adminHref} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/20 hover:text-white">
            Admin console
          </Link>
        )}
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-48">
        {panel === "signup" && (
          <NewKioskUser
            siteId={siteId}
            siteName={site?.name}
            onCreated={(employee) => {
              setAddedPeople((prev) => [...prev, { ...employee, hasPin: true }]);
              setPanel(null);
              setNotice(
                `You're all set, ${employee.name.split(" ")[0]}! Add your items, then tap Log ${actionLabel} and enter your PIN.`
              );
              router.refresh();
            }}
            onCancel={() => setPanel(null)}
          />
        )}

        {panel === "recovery" && (
          <PinRecovery
            people={people}
            onDone={(name) => {
              setPanel(null);
              setNotice(
                `New PIN saved for ${name}. Add your items, then tap Log ${actionLabel} and enter it.`
              );
              router.refresh();
            }}
            onCancel={() => setPanel(null)}
          />
        )}

        {panel === null && (
          <>
            <div className="mb-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => openPanel("signup")}
                className="kiosk-bubble relative rounded-full bg-[#134229] px-5 py-2.5 text-base font-bold text-white shadow-lg ring-4 ring-[#d4edd6] active:scale-95"
              >
                <span aria-hidden className="mr-1.5">🫧</span>
                Need a Pin? Click Here
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 left-8 h-3.5 w-3.5 rotate-45 bg-[#134229]"
                />
              </button>
              <button
                type="button"
                onClick={() => openPanel("recovery")}
                className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
              >
                Forgot your PIN?
              </button>
            </div>

            {notice && (
              <p className="mb-4 flex items-center gap-2 rounded-lg bg-[#eef6f0] px-4 py-3 text-sm text-[#134229]">
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                {notice}
              </p>
            )}

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
                  <QuantityInput
                    value={line.quantity}
                    onCommit={(n) => setQty(line.itemId, n)}
                  />
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
      </div>

      {panel === null && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4">
          {cart.length === 0 && (
            <p className="mb-2 text-center text-xs text-gray-400">Add at least one item.</p>
          )}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => {
              setNotice(null);
              setPinOpen(true);
            }}
            className="w-full rounded-xl border border-black bg-black py-4 text-lg font-semibold text-white transition-colors hover:bg-white hover:text-black disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {isReturn ? `Log return (${cart.length})` : `Log checkout (${cart.length})`}
          </button>
        </div>
      )}

      {pinOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm">
            <PinPad
              title="Enter your PIN"
              subtitle={`To log this ${actionLabel} — ${cart.length} item${
                cart.length === 1 ? "" : "s"
              } · ${totalUnits} unit${totalUnits === 1 ? "" : "s"}`}
              value={pinValue}
              error={pinError}
              disabled={pinPending}
              onChange={handlePinChange}
            />
            <div className="mt-3 flex items-center justify-center gap-6 text-sm">
              <button
                type="button"
                onClick={closePin}
                disabled={pinPending}
                className="rounded-full bg-white/90 px-4 py-1.5 text-gray-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => openPanel("recovery")}
                disabled={pinPending}
                className="rounded-full bg-white/90 px-4 py-1.5 text-gray-700 hover:bg-white"
              >
                Forgot your PIN?
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
