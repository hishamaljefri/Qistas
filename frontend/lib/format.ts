export const formatSAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n) + " ريال";

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
