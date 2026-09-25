"use client";

export default function RetireButton({ itemName }: { itemName: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(`Retire "${itemName}"? It'll be hidden from active lists.`)) {
          e.preventDefault();
        }
      }}
      className="text-xs text-red-600 hover:underline"
    >
      retire
    </button>
  );
}
