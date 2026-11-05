/**
 * Values fixed when the app is bundled. Expo replaces `process.env.EXPO_PUBLIC_*` with the value
 * the variable had at build time (it must be written exactly like this, never read dynamically).
 * Docs: https://docs.expo.dev/guides/environment-variables/
 */

/** API origin of the build, for example `https://api.example.com`. A person can override it in Settings. */
const rawApiBaseUrl: unknown = process.env.EXPO_PUBLIC_API_BASE_URL;
export const BUILD_API_BASE_URL: string | undefined =
  typeof rawApiBaseUrl === "string" ? rawApiBaseUrl : undefined;

/**
 * Whether Settings accepts plain http on loopback and private LAN addresses. A Metro dev bundle
 * (`__DEV__`) always does. The CI debug APK embeds a production-mode bundle (`__DEV__` is false) so it
 * runs without a PC, and sets `EXPO_PUBLIC_ALLOW_LAN_HTTP=1`; its debug manifest allows the same
 * cleartext natively. Release builds set neither, so they stay https only.
 */
export function allowsPrivateLanHttp(isDevBundle: boolean, flag: unknown): boolean {
  return isDevBundle || flag === "1";
}

const rawAllowLanHttp: unknown = process.env.EXPO_PUBLIC_ALLOW_LAN_HTTP;
export const LAN_HTTP_FLAG: unknown = rawAllowLanHttp;

/** Shows the test tools in Settings (device id, test record). Set only in development builds. */
const rawDevTools: unknown = process.env.EXPO_PUBLIC_DEV_TOOLS;
export const DEV_TOOLS_ENABLED: boolean = rawDevTools === "1";
