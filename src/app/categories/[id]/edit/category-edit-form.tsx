"use client";

import { useActionState } from "react";
import { updateCategory } from "../../actions";
import type { Category } from "@prisma/client";

export default function CategoryEditForm({
  category,
  categories,
}: {
  category: Category;
  categories: Category[];
}) {
  const [state, formAction, pending] = useActionState(updateCategory, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="categoryId" value={category.id} />

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
          defaultValue={category.name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Parent category
        </label>
        <select
          name="parentId"
          defaultValue={category.parentId ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">None (top-level)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Legacy code (optional)
        </label>
        <input
          name="legacyCode"
          defaultValue={category.legacyCode ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
