/** Decorative by default; pass a label when the spinner is the only sign of loading. */
export function Spinner({ label, className = "size-5" }: { label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`q-spin shrink-0 ${className}`}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
