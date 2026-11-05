/**
 * The API origin the app talks to, and the rule that keeps plain http for private networks only.
 *
 * Release builds use https. Debug builds may also use `http://<PC LAN IP>:8000` so a phone on the
 * same Wi-Fi can reach the developer's local backend. Android's network security config cannot
 * express IP ranges, so this module is the one place that narrows "any http host" to
 * "private LAN addresses" (see `plugins/with-debug-lan-cleartext.js`).
 */

export type ApiBaseUrlProblem = "empty" | "invalid" | "cleartextNotAllowed";

export type ApiBaseUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly problem: ApiBaseUrlProblem };

// scheme://host[:port], nothing else: the client adds `/api/v1/...` itself.
const ORIGIN_PATTERN = /^(https?):\/\/([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/;
const IPV4_PATTERN = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;
const MAX_PORT = 65535;
const MAX_OCTET = 255;

function parseIpv4(host: string): readonly number[] | null {
  const match = IPV4_PATTERN.exec(host);
  if (match === null) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= MAX_OCTET) ? octets : null;
}

function isPrivateIpv4([first = -1, second = -1]: readonly number[]): boolean {
  const isLoopback = first === 127;
  const isClassA = first === 10;
  const isClassB = first === 172 && second >= 16 && second <= 31;
  const isClassC = first === 192 && second === 168;
  return isLoopback || isClassA || isClassB || isClassC;
}

/** True for hosts where plain http is acceptable: localhost and private IPv4 ranges. */
export function isPrivateLanHost(host: string): boolean {
  if (host === "localhost") return true;
  const octets = parseIpv4(host);
  return octets !== null && isPrivateIpv4(octets);
}

function hasValidPort(port: string | undefined): boolean {
  return port === undefined || (Number(port) >= 1 && Number(port) <= MAX_PORT);
}

function canUseScheme(scheme: string, host: string, allowCleartext: boolean): boolean {
  return scheme !== "http" || (allowCleartext && isPrivateLanHost(host));
}

/**
 * Validates and normalizes an API origin typed by a person or set at build time.
 * Trailing slashes are removed. A path, query, user info or an https-less public host is refused.
 */
export function parseApiBaseUrl(
  input: string | undefined,
  allowCleartext = true,
): ApiBaseUrlResult {
  const trimmed = (input ?? "").trim().replace(/\/+$/, "");
  if (trimmed === "") return { ok: false, problem: "empty" };
  const match = ORIGIN_PATTERN.exec(trimmed);
  const [, scheme, host, port] = match ?? [];
  if (scheme === undefined || host === undefined || !hasValidPort(port)) {
    return { ok: false, problem: "invalid" };
  }
  if (!canUseScheme(scheme, host, allowCleartext)) {
    return { ok: false, problem: "cleartextNotAllowed" };
  }
  return { ok: true, url: trimmed };
}
