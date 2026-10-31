import type { ReactNode } from "react";

export const cardClass = "rounded-card border border-line bg-surface shadow-card";

/** A card section. `title` becomes an h2 linked to the section; size="sm" is for side columns. */
export function Card({
  title,
  id,
  icon,
  action,
  size = "md",
  children,
  className = "",
}: {
  title?: ReactNode;
  id?: string;
  icon?: ReactNode;
  action?: ReactNode;
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  const sm = size === "sm";
  return (
    <section
      id={id}
      aria-labelledby={title ? titleId : undefined}
      className={`flex flex-col max-md:px-[18px] max-md:py-[22px] ${sm ? "gap-3.5 p-[26px]" : "gap-5 p-8"} ${cardClass} ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {title && (
            <h2 id={titleId} className={`flex items-center gap-2.5 leading-[1.4] font-semibold ${sm ? "text-lg" : "text-[22px]"}`}>
              {icon}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
