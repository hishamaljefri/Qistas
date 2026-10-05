export function Spinner() {
  return (
    <span
      role="status"
      aria-label="جارٍ التحميل"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
    />
  );
}
