import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control = "w-full rounded-control border border-line bg-surface px-3 py-2 text-text placeholder:text-muted focus:outline-2 focus:outline-primary";

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export const TextArea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={control} {...props} />;
export const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => <input className={control} {...props} />;
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className={control} {...props} />;
