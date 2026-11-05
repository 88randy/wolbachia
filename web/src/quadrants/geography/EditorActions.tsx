import { useTranslation } from "react-i18next";
import type { QuadrantDraft } from "./use-quadrant-draft";
import { PublishBlocker } from "./PublishBlocker";
import styles from "./geography.module.css";
interface Props {
  draft: QuadrantDraft;
  refresh: () => Promise<number | null>;
}
export function EditorActions({ draft, refresh }: Props) {
  const { t } = useTranslation();
  const actions = {
    publish: !draft.canSubmit,
    discard: draft.write.isBusy,
    refresh: draft.write.isBusy || draft.points.isFetching,
  };
  return (
    <div className={styles.actions}>
      <button type="submit" disabled={actions.publish} aria-describedby="publish-blocker">
        {t("geography.editor.publish")}
      </button>
      <button type="button" disabled={actions.discard} onClick={draft.discard}>
        {t("geography.editor.discard")}
      </button>
      <button
        type="button"
        disabled={actions.refresh}
        onClick={() => {
          void reapply(draft, refresh);
        }}
      >
        {t("geography.editor.refresh")}
      </button>
      <PublishBlocker draft={draft} />
    </div>
  );
}

async function reapply(draft: QuadrantDraft, refresh: Props["refresh"]) {
  const [revision, points] = await Promise.all([refresh(), draft.points.refetch()]);
  if (revision !== null && !points.isError) {
    draft.setRevision(revision);
    draft.write.clear();
  }
}
