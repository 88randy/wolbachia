const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const WHOLE_NUMBER = /^\d+$/;
// IMF-fixdate, the only HTTP-date form servers should send (RFC 9110): "Wed, 04 Nov 2026 12:10:00 GMT".
const HTTP_DATE = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;
/** An absurd wait (a misconfigured proxy) is shown as "unknown" instead of "10000 min". */
const MAX_MINUTES = 24 * 60;

function minutesFromSeconds(seconds: number): number | undefined {
  const minutes = Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE));
  return minutes > MAX_MINUTES ? undefined : minutes;
}

/**
 * How many whole minutes to wait according to a `Retry-After` header (delta-seconds or an HTTP
 * date), rounded up and at least 1; undefined when the header is missing or unusable.
 */
export function retryAfterMinutes(
  header: string | null,
  now: Date = new Date(),
): number | undefined {
  if (header === null) return undefined;
  const value = header.trim();
  if (WHOLE_NUMBER.test(value)) return minutesFromSeconds(Number(value));
  if (!HTTP_DATE.test(value)) return undefined;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return minutesFromSeconds((date - now.getTime()) / MS_PER_SECOND);
}
