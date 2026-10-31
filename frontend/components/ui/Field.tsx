import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { text } from "@/lib/text";

// shared control look; size, padding and corners are set per control so they never conflict
const control =
  "w-full border-[1.5px] border-line-strong bg-surface text-text placeholder:text-muted aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger disabled:opacity-60";

/** Label + control + hint or error. The hint/error is linked to the control via `${htmlFor}-hint`. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={htmlFor} className="text-base font-semibold">
        {label} {optional && <span className="font-normal text-muted">{text.optional}</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-hint`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-sm leading-[1.7] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export const TextArea = ({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`${control} resize-y rounded-[14px] px-[18px] py-4 text-[17px] leading-[1.9] ${className}`} {...props} />
);
export const TextInput = ({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`${control} min-h-12 rounded-control px-4 text-base ${className}`} {...props} />
);
export const Select = ({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`${control} min-h-12 rounded-control px-4 text-base ${className}`} {...props} />
);

/** A checkbox with its label text beside it. */
export function Checkbox({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 text-[15px] leading-[1.7] ${className}`}>
      <input type="checkbox" className="mt-[3px] size-5 shrink-0 accent-primary" {...props} />
      <span>{label}</span>
    </label>
  );
}
