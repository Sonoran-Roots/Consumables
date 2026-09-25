"use client";

import { useActionState, useState } from "react";
import { createSite } from "../actions";
import type { Book } from "@prisma/client";

function suggestCode(bookCode: string, name: string) {
  const slug = name.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
  return bookCode ? `${bookCode}-${slug}` : slug;
}

export default function SiteForm({ books }: { books: Book[] }) {
  const [state, formAction, pending] = useActionState(createSite, null);
  const [name, setName] = useState("");
  const [bookCode, setBookCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [code, setCode] = useState("");

  const displayedCode = codeTouched ? code : suggestCode(bookCode, name);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Book *</label>
        <select
          name="bookId"
          required
          onChange={(e) =>
            setBookCode(e.target.selectedOptions[0]?.dataset.code ?? "")
          }
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {books.map((b) => (
            <option key={b.id} value={b.id} data-code={b.code}>
              {b.name} ({b.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='e.g. "Roosevelt"'
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Code * (must be unique — auto-suggested, editable)
        </label>
        <input
          name="code"
          required
          value={displayedCode}
          onChange={(e) => {
            setCodeTouched(true);
            setCode(e.target.value);
          }}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input
          name="address"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          name="type"
          defaultValue="FACILITY"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="FACILITY">Facility (a real physical site)</option>
          <option value="STAGING">Staging (e.g. intake/receiving)</option>
          <option value="VIRTUAL">
            Virtual (e.g. an out-of-state sales channel)
          </option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="isStaging" className="rounded border-gray-300" />
        Also flag as a staging location
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create site"}
      </button>
    </form>
  );
}
