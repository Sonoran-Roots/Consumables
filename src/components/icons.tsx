// Minimal hand-drawn outline icons (no external icon library dependency).
// All accept a className so callers can size/color them via Tailwind.

type IconProps = { className?: string };

const base = "1.8";

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth={base}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth={base}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={base}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth={base} />
      <rect x="13" y="4" width="7" height="4" rx="1.2" stroke="currentColor" strokeWidth={base} />
      <rect x="13" y="10" width="7" height="10" rx="1.2" stroke="currentColor" strokeWidth={base} />
      <rect x="4" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth={base} />
    </svg>
  );
}

export function BoxIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
        stroke="currentColor"
        strokeWidth={base}
        strokeLinejoin="round"
      />
      <path d="M4.5 7.5L12 12l7.5-4.5M12 12v9" stroke="currentColor" strokeWidth={base} strokeLinejoin="round" />
    </svg>
  );
}

export function SwapIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 8h13m0 0l-4-4m4 4l-4 4M20 16H7m0 0l4 4m-4-4l4-4"
        stroke="currentColor"
        strokeWidth={base}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 4h2l2.4 12.2a2 2 0 002 1.8h8.2a2 2 0 002-1.6L20 8H6"
        stroke="currentColor"
        strokeWidth={base}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="20.5" r="1.4" fill="currentColor" />
      <circle cx="17.5" cy="20.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={base} />
      <path
        d="M19.4 13.5a1.7 1.7 0 000-3l1.1-1.9-2-2-1.9 1.1a1.7 1.7 0 00-3 0L12.5 5h-2l-.1 2.2a1.7 1.7 0 00-3 0L5.5 6.1l-2 2 1.1 1.9a1.7 1.7 0 000 3L3.5 15l2 2 1.9-1.1a1.7 1.7 0 003 0l.1 2.1h2l.1-2.1a1.7 1.7 0 003 0l1.9 1.1 2-2-1.1-1.9z"
        stroke="currentColor"
        strokeWidth={base}
        strokeLinejoin="round"
      />
    </svg>
  );
}
