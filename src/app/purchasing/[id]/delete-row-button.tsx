"use client";

export default function DeleteRowButton({ confirmText }: { confirmText: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmText)) {
          e.preventDefault();
        }
      }}
      className="text-xs text-red-500 hover:text-red-700 hover:underline"
    >
      delete
    </button>
  );
}
