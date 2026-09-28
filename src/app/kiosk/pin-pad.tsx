"use client";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function PinPad({
  title,
  subtitle,
  value,
  length = 4,
  error,
  disabled,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: string;
  length?: number;
  error?: string | null;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  function press(key: string) {
    if (disabled) return;
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "") return;
    if (value.length >= length) return;
    onChange(value + key);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-center text-base font-medium text-gray-900">{title}</p>
      {subtitle && <p className="mt-0.5 text-center text-sm text-gray-500">{subtitle}</p>}

      <div className="my-5 flex items-center justify-center gap-3">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 ${
              i < value.length ? "border-black bg-black" : "border-gray-300 bg-transparent"
            } ${error ? "!border-red-500 !bg-red-500" : ""}`}
          />
        ))}
      </div>

      {error && <p className="mb-3 text-center text-sm text-red-700">{error}</p>}

      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              className={`flex h-14 items-center justify-center rounded-xl text-xl font-medium active:bg-gray-200 disabled:opacity-40 ${
                key === "back" ? "bg-gray-50 text-gray-500" : "bg-gray-100 text-gray-900"
              }`}
            >
              {key === "back" ? "⌫" : key}
            </button>
          )
        )}
      </div>
    </div>
  );
}
