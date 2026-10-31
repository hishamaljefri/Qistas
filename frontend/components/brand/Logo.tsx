import Link from "next/link";
import { text } from "@/lib/text";

// The QISTAS mark (qistas-logo/qistas-mark.svg), colored by the --logo-* tokens so it follows dark mode.
// The beam and the two pans carry the q-beam / q-pan-* classes used by the waiting animation.
export function ScaleMark({ className = "size-10", strokeWidth = 3, label }: { className?: string; strokeWidth?: number; label?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`overflow-visible ${className}`} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      <path d="M52 12 L58 19 L52 26 L46 19 Z M68 12 L74 19 L68 26 L62 19 Z" fill="var(--logo-gold)" />
      <rect x="55.5" y="29" width="9" height="65" rx="4.5" fill="var(--logo-beam)" />
      <g className="q-pan-l">
        <path d="M22 38 L11 67 M22 38 L33 67" stroke="var(--logo-beam)" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <path d="M8 67 H36 A14 14 0 0 1 8 67 Z" fill="var(--logo-pan)" />
      </g>
      <g className="q-pan-r">
        <path d="M98 38 L87 67 M98 38 L109 67" stroke="var(--logo-beam)" strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <path d="M84 67 H112 A14 14 0 0 1 84 67 Z" fill="var(--logo-pan)" />
      </g>
      <rect className="q-beam" x="13" y="32" width="94" height="8" rx="4" fill="var(--logo-beam)" />
      <rect x="36" y="92" width="48" height="9" rx="4.5" fill="var(--logo-beam)" />
    </svg>
  );
}

/** One-color scale used as an icon: tilt < 0 leans toward the worker (high likelihood), > 0 away. */
export function ScaleIcon({ tilt = 0, className = "size-5" }: { tilt?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 120" className={`shrink-0 ${className}`} fill="currentColor">
      <g transform={`rotate(${tilt} 60 36)`}>
        <rect x="13" y="32" width="94" height="9" rx="4.5" />
        <path d="M8 67 H36 A14 14 0 0 1 8 67 Z" />
        <path d="M84 67 H112 A14 14 0 0 1 84 67 Z" />
        <path d="M22 38 L11 67 M22 38 L33 67 M98 38 L87 67 M98 38 L109 67" stroke="currentColor" strokeWidth="5" fill="none" />
      </g>
      <rect x="54" y="29" width="12" height="65" rx="6" />
      <rect x="34" y="90" width="52" height="12" rx="6" />
    </svg>
  );
}

/** Mark + Arabic wordmark + Latin wordmark, linking home. */
export function Wordmark() {
  return (
    <Link href="/" aria-label={text.homeLabel} className="flex items-center gap-3 no-underline">
      <ScaleMark className="size-10" strokeWidth={4} />
      <span className="flex flex-col leading-[1.1]">
        <span className="font-logo text-2xl font-bold text-(--logo-word)">{text.appName}</span>
        <span className="font-latin text-[10px] font-semibold tracking-[3px] text-muted">QISTAS</span>
      </span>
    </Link>
  );
}
