import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { ScannerError } from "./domain.ts";

const ERROR_KEYS: Readonly<Record<ScannerError, MessageKey>> = {
  invalid: "mobile.scanner.invalid",
  version: "mobile.scanner.version",
  kind: "mobile.scanner.kind",
  unavailable: "mobile.scanner.unavailable",
  retired: "mobile.scanner.retired",
  duplicate: "mobile.scanner.duplicate",
  storage: "mobile.scanner.storage",
};

/** Invalid results disclose no hidden resource identity or courier assignment. */
export function InvalidCode({ reason }: { readonly reason: ScannerError }) {
  const t = useT();
  return (
    <Notice
      tone={reason === "storage" ? "critical" : "warning"}
      icon="alert"
      message={t(ERROR_KEYS[reason])}
    />
  );
}
