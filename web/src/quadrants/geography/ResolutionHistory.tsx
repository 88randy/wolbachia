import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
const LABELS = {
  keep: "geography.editor.keep",
  move: "geography.editor.move",
  remove: "geography.editor.remove",
} as const;
interface Props {
  version: Schemas["QuadrantVersion"];
  pointCode: (id: string) => string;
}
export function ResolutionHistory({ version, pointCode }: Props) {
  const { t } = useTranslation();
  return (
    <details id={"version-" + version.id}>
      <summary>{t("geography.field.geometry")}</summary>
      {version.point_resolutions.map((resolution) => (
        <p key={resolution.id}>
          {pointCode(resolution.point)}
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
