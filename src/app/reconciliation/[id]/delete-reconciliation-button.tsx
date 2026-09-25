"use client";

export default function DeleteReconciliationButton() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (
          !confirm(
            "Delete this reconciliation? This cannot be undone, even if closed."
          )
        ) {
          e.preventDefault();
        }
      }}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
    >
      Delete
    </button>
  );
}
