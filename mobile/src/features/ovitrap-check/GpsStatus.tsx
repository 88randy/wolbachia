import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { CaptureProps } from "./model.ts";
import { useDraftLocation } from "./use-draft-location.ts";

/** Calm location line: looking for it, ready with its accuracy, or saved without it. */
export function GpsStatus(props: CaptureProps) {
  const t = useT();
  const status = useDraftLocation(props);
  if (props.model.state?.event) return null;
  if (status.kind === "missing")
    return <InfoNotice tone="warning" message={t("field.gps.missing")} />;
  const meters = status.accuracyM === null ? "" : String(Math.round(status.accuracyM));
  if (status.kind === "ready")
    return (
      <InfoNotice
        tone="success"
        message={t(meters ? "field.gps.readyAccuracy" : "field.gps.ready", { meters })}
      />
    );
  return (
    <InfoNotice
      tone="info"
      message={t(meters ? "field.gps.searchingAccuracy" : "field.gps.searching", { meters })}
    />
  );
}
