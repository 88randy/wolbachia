import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { parseResetFragment } from "./reset-link";
import { ResetPasswordScreen } from "./ResetPasswordScreen";

/**
 * Target of the emailed link, `/reset-password#uid=...&token=...` (the path the backend builds
 * from `WEB_PASSWORD_RESET_PATH`). A fragment is never sent to a server, so the token stays out
 * of every access log and proxy. It is read once, kept in memory and removed from the address
 * bar by the screen. (Reloading therefore needs the emailed link again.)
 */
export function ResetPasswordPage() {
  const hash = useRouterState({ select: (state) => state.location.hash });
  const [link] = useState(() => parseResetFragment(hash));
  return <ResetPasswordScreen link={link} />;
}
