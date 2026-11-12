import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { ScannerError } from "./domain.ts";

const ERROR_KEYS: Readonly<Record<ScannerError, MessageKey>> = {
  invalid: "field.scan.invalid",
  version: "field.scan.version",
  kind: "field.scan.kind",
  unavailable: "field.scan.unavailable",
  retired: "field.scan.retired",
  duplicate: "field.scan.duplicate",
  storage: "field.scan.storage",
  labelUsed: "field.scan.labelUsed",
  labelUnknown: "field.scan.labelUnknown",
};

/** A code that does not work, in plain words. It never reveals what the code belongs to. */
export function InvalidCode({
  reason,
  pointCode = null,
}: {
  readonly reason: ScannerError;
  /** Where an already placed label is, when the phone knows it. */
  readonly pointCode?: string | null;
}) {
  const t = useT();
  return (
    <InfoNotice
      tone={reason === "storage" ? "danger" : "warning"}
      message={
        reason === "labelUsed" && pointCode !== null
          ? t("field.scan.labelPlacedAt", { point: pointCode })
          : t(ERROR_KEYS[reason])
      }
    />
  );
}
