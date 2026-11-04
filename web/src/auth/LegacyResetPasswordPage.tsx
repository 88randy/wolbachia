import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ResetPasswordScreen } from "./ResetPasswordScreen";

/**
 * Links emailed before #58 carry the values in the path, `/reset-password/{uid}/{token}`. Kept
 * for one token lifetime (`PASSWORD_RESET_TIMEOUT`, 3600 s) after the first deploy of #58; the
 * removal rule is in "Reset-link formats" in web/README.md and decision 83 in docs/decisions.md.
 */
export function LegacyResetPasswordPage() {
  const params = useParams({ from: "/reset-password/$uid/$token" });
  const [link] = useState(params);
  return <ResetPasswordScreen link={link} />;
}
