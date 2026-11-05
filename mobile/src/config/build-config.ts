/**
 * Values fixed when the app is bundled. Expo replaces `process.env.EXPO_PUBLIC_*` with the value
 * the variable had at build time (it must be written exactly like this, never read dynamically).
 * Docs: https://docs.expo.dev/guides/environment-variables/
 */

/** API origin of the build, for example `https://api.example.com`. A person can override it in Settings. */
const rawApiBaseUrl: unknown = process.env.EXPO_PUBLIC_API_BASE_URL;
export const BUILD_API_BASE_URL: string | undefined =
  typeof rawApiBaseUrl === "string" ? rawApiBaseUrl : undefined;

/** Shows the test tools in Settings (device id, test record). Set only in development builds. */
const rawDevTools: unknown = process.env.EXPO_PUBLIC_DEV_TOOLS;
export const DEV_TOOLS_ENABLED: boolean = rawDevTools === "1";
