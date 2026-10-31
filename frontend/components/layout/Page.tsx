import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** Page column: centered, max width per screen, 24px gutter (16px on phones). */
export function Page({ width = "max-w-[1200px]", className = "", children }: { width?: string; className?: string; children: ReactNode }) {
  return <div className={`mx-auto flex w-full flex-col gap-6 px-6 pt-10 pb-16 max-md:px-4 max-md:pt-5 max-md:pb-12 ${width} ${className}`}>{children}</div>;
}

/** Page heading (h1) with an optional line under it. */
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-3xl leading-[1.4] font-semibold max-md:text-2xl">{children}</h1>
      {sub && <p className="text-[15px] text-muted">{sub}</p>}
    </div>
  );
}

const backClass = "inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium no-underline";

/** Link back to the parent page (the arrow points right in a right-to-left page). */
export function BackLink({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  const content = (
    <>
      <Icon name="arrowBack" className="size-[18px]" />
      {children}
    </>
  );
  if (href)
    return (
      <Link href={href} className={backClass}>
        {content}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={`${backClass} text-primary hover:text-primary-hover`}>
      {content}
    </button>
  );
}
