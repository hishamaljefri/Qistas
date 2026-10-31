"use client";

/** Two-way switch: a toggle group (aria-pressed) or, with kind="tabs", a tab list (aria-selected). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  kind = "toggle",
  size = "sm",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  kind?: "toggle" | "tabs";
  size?: "sm" | "lg";
}) {
  const tabs = kind === "tabs";
  return (
    <div
      role={tabs ? "tablist" : "group"}
      aria-label={label}
      className={`grid grid-cols-2 gap-1 bg-surface-muted p-1 ${size === "lg" ? "rounded-[14px]" : "rounded-[12px]"}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? on : undefined}
            aria-pressed={tabs ? undefined : on}
            onClick={() => onChange(o.value)}
            className={`font-semibold transition-colors ${size === "lg" ? "min-h-12 rounded-[10px] text-base" : "min-h-10 rounded-[9px] text-sm"} ${
              on ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
