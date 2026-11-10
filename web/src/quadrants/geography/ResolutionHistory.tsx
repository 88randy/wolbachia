import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { polygonText } from "./geometry";
const LABELS = {
  keep: "geography.editor.keep",
  move: "geography.editor.move",
  remove: "geography.editor.remove",
} as const;
export function ResolutionHistory({ version }: { version: Schemas["QuadrantVersion"] }) {
  const { t } = useTranslation();
  return (
    <details id={"version-" + version.id}>
      <summary>{t("geography.field.geometry")}</summary>
      <pre>{polygonText(version.geometry)}</pre>
      {version.point_resolutions.map((resolution) => (
        <p key={resolution.id}>
          {resolution.point}
          {" · "}
          {t(LABELS[resolution.decision])}
          {" · "}
          {resolution.evidence}
          {" · "}
          {resolution.created_by_name ?? t("geography.status.unknown")}
        </p>
      ))}
    </details>
  );
}
