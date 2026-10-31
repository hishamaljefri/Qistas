// Lines up the text sent to the AI (with [EMPLOYEE_1]-style placeholders) with the user's own text,
// to show the privacy reveal. No UI here.
//
// The backend builds `description` as masked_description with every placeholder replaced by its real
// value, so one regular expression (literal text + one lazy group per placeholder, a back-reference when
// the same placeholder repeats) recovers each value. If anything does not line up, it returns null.

const PLACEHOLDER = /(\[[A-Z]+(?:_[A-Z]+)*_\d+\])/;

export interface Segment {
  text: string; // literal text, or the placeholder itself
  placeholder?: string; // e.g. "[EMPLOYER_1]"
  original?: string; // the real value behind the placeholder
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits the masked text into literal parts and placeholders (works without the original). */
export function maskedSegments(masked: string): Segment[] {
  return masked
    .split(PLACEHOLDER)
    .map((part, i) => (i % 2 ? { text: part, placeholder: part } : { text: part }))
    .filter((s) => s.text);
}

/** Same segments, each placeholder with its real value from `original`; null if they do not line up. */
export function alignMasked(masked: string, original: string): Segment[] | null {
  const segments = maskedSegments(masked);
  const seen = new Set<string>();
  const pattern = segments
    .map((s) => {
      if (!s.placeholder) return escape(s.text);
      const name = s.placeholder.slice(1, -1);
      if (seen.has(name)) return `\\k<${name}>`;
      seen.add(name);
      return `(?<${name}>[\\s\\S]+?)`;
    })
    .join("");
  let match: RegExpMatchArray | null;
  try {
    match = original.match(new RegExp(`^${pattern}$`));
  } catch {
    return null;
  }
  if (!match?.groups) return seen.size === 0 && match ? segments : null;
  const groups = match.groups;
  return segments.map((s) => (s.placeholder ? { ...s, original: groups[s.placeholder.slice(1, -1)] } : s));
}
