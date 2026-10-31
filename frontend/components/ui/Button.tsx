import type { ComponentProps } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "text" | "danger" | "danger-solid";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover hover:text-primary-fg",
  secondary: "border-[1.5px] border-line-strong bg-surface text-text hover:bg-surface-muted hover:text-text",
  text: "text-primary hover:bg-surface-muted",
  danger: "text-danger hover:bg-danger-bg hover:text-danger",
  "danger-solid": "bg-danger text-surface hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "min-h-11 rounded-control px-4 text-[15px]",
  md: "min-h-12 rounded-control px-5 text-[15px]",
  lg: "min-h-14 rounded-[14px] px-9 text-lg",
};

/** Shared look for <button> and for links that should look like buttons. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className = "") {
  return `inline-flex items-center justify-center gap-2 text-center font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-line disabled:text-muted ${variants[variant]} ${sizes[size]} ${className}`;
}

type Props = ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean };

export function Button({ variant = "primary", size = "md", loading = false, className = "", type = "button", disabled, children, ...props }: Props) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
