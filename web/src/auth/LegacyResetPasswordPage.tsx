import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { replaceAddressBar } from "../router/replace-address-bar";
import { RESET_ADDRESS, toResetLink } from "./reset-link";
import { ResetPasswordScreen } from "./ResetPasswordScreen";

/**
 * Links emailed before #58 carry the values in the path, `/reset-password/{uid}/{token}`. Kept
 * for one token lifetime (`PASSWORD_RESET_TIMEOUT`, 3600 s) after the first deploy of #58; the
 * removal rule is in "Reset-link formats" in web/README.md and decision 83 in docs/decisions.md
 * (follow-up #62).
 */
export function LegacyResetPasswordPage() {
  const params = useParams({ from: "/reset-password/$uid/$token" });
  const [link] = useState(() => toResetLink(params.uid, params.token));
  useEffect(() => {
    replaceAddressBar(RESET_ADDRESS);
  }, []);
  return <ResetPasswordScreen link={link} revision={0} />;
}
