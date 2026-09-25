"use client";

import { useActionState } from "react";
import { updateBook } from "../../../sites/actions";
import type { Book } from "@prisma/client";

export default function BookEditForm({ book }: { book: Book }) {
  const [state, formAction, pending] = useActionState(updateBook, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bookId" value={book.id} />

      {state?.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          name="name"
          required
          defaultValue={book.name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Code * (short, e.g. RTL)
        </label>
        <input
          name="code"
          required
          maxLength={10}
          defaultValue={book.code}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
