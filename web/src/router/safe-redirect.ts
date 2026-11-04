const HOME = "/";
const LOGIN_PATH = "/login";
/** Never resolved: only used to ask the URL parser whether a target stays on our origin. */
const PROBE_ORIGIN = "https://app.invalid";
// Browsers drop tabs and newlines inside a URL, so "/\t/host" would become "//host".
// eslint-disable-next-line no-control-regex -- matching control characters is the point.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** Whether a string could stay on our origin: a "/" path, no "//" start, no "\\", no control characters. */
function isInternalShape(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !CONTROL_CHARACTERS.test(value)
  );
}

/**
 * The only way a `redirect` search parameter may become a navigation target: an internal path
 * ("/settings?tab=1") and nothing else. Anything that could leave the app (`//host`, `/\host`,
 * `https://...`, `javascript:`, control characters) or loop back to the sign-in page becomes
 * Home. The input AND the normalized output are checked (dot segments turn "/..//host" into
 * "//host"). Prevents open redirects after sign-in.
 */
export function safeRedirect(target: string | undefined): string {
  if (target === undefined || !isInternalShape(target)) return HOME;
  const parsed = new URL(target, PROBE_ORIGIN);
  if (parsed.origin !== PROBE_ORIGIN) return HOME;
  if (parsed.pathname === LOGIN_PATH || parsed.pathname.startsWith(`${LOGIN_PATH}/`)) return HOME;
  const result = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return isInternalShape(result) ? result : HOME;
}
