import { ResetPasswordScreen } from "./ResetPasswordScreen";
import { useResetLinkFragment } from "./use-reset-link-fragment";

/**
 * Target of the emailed link, `/reset-password#uid=...&token=...` (the path the backend builds
 * from `WEB_PASSWORD_RESET_PATH`). A fragment is never sent to a server, so the token stays out
 * of every access log and proxy. Every fragment that arrives (also a second link pasted into the
 * same tab) is read, kept in memory and removed from the address bar. The router's in-memory
 * location keeps the hash until the next navigation (memory only, never the history entry).
 * Reloading therefore needs the emailed link again.
 */
export function ResetPasswordPage() {
  const { link, revision } = useResetLinkFragment();
  return <ResetPasswordScreen link={link} revision={revision} />;
}
