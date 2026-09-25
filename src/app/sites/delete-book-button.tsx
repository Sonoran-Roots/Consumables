"use client";

export default function DeleteBookButton({ bookName }: { bookName: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(`Delete book "${bookName}"? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
      className="text-xs text-red-500 hover:text-red-700 hover:underline"
    >
      delete
    </button>
  );
}
