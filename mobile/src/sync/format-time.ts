const TWO_DIGITS = 2;

/** `HH:mm` of an ISO instant in the phone's local time. Returns the input when it is not a date. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hours = String(date.getHours()).padStart(TWO_DIGITS, "0");
  const minutes = String(date.getMinutes()).padStart(TWO_DIGITS, "0");
  return `${hours}:${minutes}`;
}
