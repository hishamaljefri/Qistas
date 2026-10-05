import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const look =
    variant === "primary"
      ? "bg-primary text-primary-fg hover:opacity-90"
      : "bg-surface text-text border border-line hover:bg-surface-muted";
  return (
    <button
      className={`rounded-control px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
      {...props}
    />
  );
}
