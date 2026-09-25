"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { logKioskCheckout } from "../checkouts/actions";

type Site = { id: string; name: string };
type Employee = { id: string; name: string };
type Item = { id: string; name: string; sku: string | null };
type CartLine = { itemId: string; name: string; quantity: number };

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
    }
  }, [state]);

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
    return <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>;
  }

  if (!siteId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Which site is this?</h1>
        <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => chooseSite(s.id)}
              className="rounded-xl border border-gray-200 bg-white px-6 py-5 text-lg font-medium text-gray-900 shadow-sm active:bg-emerald-50"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const site = sites.find((s) => s.id === siteId);
  const canSubmit = !!employeeId && cart.length > 0 && !pending;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <button type="button" onClick={changeSite} className="text-sm text-gray-500">
          {site?.name} <span className="underline">change</span>
        </button>
        <div className="flex overflow-hidden rounded-full border border-gray-300">
          <button
            type="button"
            onClick={() => setIsReturn(false)}
            className={`px-4 py-1.5 text-sm font-medium ${
              !isReturn ? "bg-emerald-600 text-white" : "text-gray-600"
            }`}
          >
            Check out
          </button>
          <button
            type="button"
            onClick={() => setIsReturn(true)}
            className={`px-4 py-1.5 text-sm font-medium ${
              isReturn ? "bg-blue-600 text-white" : "text-gray-600"
            }`}
          >
            Return
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-44">
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Who&apos;s this?</p>
          <div className="flex flex-wrap gap-2">
            {employees.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEmployeeId(e.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  employeeId === e.id
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-300"
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item…"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(item)}
                  className="block w-full border-b border-gray-100 px-4 py-3 text-left text-base last:border-0 active:bg-emerald-50"
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {cart.length === 0 && (
            <p className="py-8 text-center text-gray-400">Search above to add items.</p>
          )}
          {cart.map((line) => (
            <div
              key={line.itemId}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <span className="flex-1 text-base text-gray-900">{line.name}</span>
              <button
                type="button"
                onClick={() => updateQty(line.itemId, -1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-medium text-gray-700"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-medium tabular-nums">
                {line.quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQty(line.itemId, 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-medium text-gray-700"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => removeLine(line.itemId)}
                className="ml-1 text-sm text-red-500"
              >
                remove
              </button>
            </div>
          ))}
        </div>

        {state?.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
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
        <input type="hidden" name="isReturn" value={String(isReturn)} />
        {cart.map((line) => (
          <span key={line.itemId}>
            <input type="hidden" name="itemId" value={line.itemId} />
            <input type="hidden" name="quantity" value={line.quantity} />
          </span>
        ))}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white disabled:opacity-40"
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
