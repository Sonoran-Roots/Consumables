"use client";

import { useActionState } from "react";
import { updateItem } from "../../actions";
import type { Category, UnitOfMeasure, Vendor, Item } from "@prisma/client";

const MATERIAL_TYPES = ["DM", "IM", "PM", "MM", "AFS", "NA"] as const;

export default function ItemEditForm({
  item,
  categories,
  unitsOfMeasure,
  vendors,
}: {
  item: Item;
  categories: Category[];
  unitsOfMeasure: UnitOfMeasure[];
  vendors: Vendor[];
}) {
  const [state, formAction, pending] = useActionState(updateItem, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="itemId" value={item.id} />

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
          defaultValue={item.name}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Brand</label>
          <input
            name="brand"
            defaultValue={item.brand ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Generic name
          </label>
          <input
            name="genericName"
            defaultValue={item.genericName ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Variant (strain/color/model)
          </label>
          <input
            name="variant"
            defaultValue={item.variant ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Size</label>
          <input
            name="size"
            defaultValue={item.size ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Category *</label>
          <select
            name="categoryId"
            required
            defaultValue={item.categoryId}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Unit of measure *
          </label>
          <select
            name="defaultUomId"
            required
            defaultValue={item.defaultUomId}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {unitsOfMeasure.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Material type
          </label>
          <select
            name="materialType"
            defaultValue={item.materialType}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {MATERIAL_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {mt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">SKU</label>
          <input
            name="sku"
            defaultValue={item.sku ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Default vendor
        </label>
        <select
          name="defaultVendorId"
          defaultValue={item.defaultVendorId ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Unspecified</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={item.isActive}
          className="rounded border-gray-300"
        />
        Active
      </label>

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
