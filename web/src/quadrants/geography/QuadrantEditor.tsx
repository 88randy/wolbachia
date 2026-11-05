import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import type { GeographyScope } from "./use-w-15";
import { useQuadrantDraft } from "./use-quadrant-draft";
import { WriteNotice } from "./WriteNotice";
import { SpacingWarnings } from "./SpacingWarnings";
import { EditorActions } from "./EditorActions";
import { EditorWorkspace } from "./EditorWorkspace";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
  refresh: () => Promise<number | null>;
}
export function QuadrantEditor({ scope, quadrant, refresh }: Props) {
  const { t } = useTranslation();
  const draft = useQuadrantDraft({ scope, quadrant });
  return (
    <section className={styles.card} aria-label={t("geography.editor.title")}>
      <h2>{t("geography.editor.title")}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void draft.publish();
        }}
      >
        <EditorWorkspace draft={draft} quadrant={quadrant} canCreatePoint={scope.canCreatePoint} />
        <EditorActions draft={draft} refresh={refresh} />
      </form>
      <WriteNotice outcome={draft.write.outcome} />
      {draft.write.outcome?.kind === "saved" && (
        <SpacingWarnings
          warnings={draft.write.outcome.value.spacing_warnings}
          points={draft.points.data ?? []}
        />
      )}
    </section>
  );
}
