import { ReauthDialog } from "./ReauthDialog";
import { useSessionExpired } from "./use-session-expired";

/** Mounted once in the shell: appears over the current page when the session ends. */
export function SessionExpiredDialog() {
  return useSessionExpired() ? <ReauthDialog /> : null;
}
