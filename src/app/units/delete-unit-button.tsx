"use client";

export default function DeleteUnitButton({ unitCode }: { unitCode: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(`Delete unit of measure "${unitCode}"? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
      className="text-xs text-red-500 hover:text-red-700 hover:underline"
    >
      delete
    </button>
  );
}
