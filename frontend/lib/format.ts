// Western digits (80,625) everywhere, as in the design handoff; shown with tabular-nums.
export const formatAmount = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

export const formatSAR = (n: number) => `${formatAmount(n)} ريال`;

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
