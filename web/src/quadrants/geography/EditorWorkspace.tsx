import { PolygonField } from "./PolygonField";
import { ExcludedPoints } from "./ExcludedPoints";
import { MapPanel } from "./MapPanel";
import type { QuadrantDraft } from "./use-quadrant-draft";
import type { Schemas } from "@wolbachia/api-client";
import styles from "./geography.module.css";
interface Props {
  draft: QuadrantDraft;
  quadrant: Schemas["Quadrant"];
  canCreatePoint: boolean;
}
export function EditorWorkspace({ draft, quadrant, canCreatePoint }: Props) {
  const map = {
    quadrants: [quadrant],
    points: draft.points.data ?? [],
    blocks: draft.blocks.data?.results ?? [],
    draft: draft.geometry,
    text: draft.text,
    onText: draft.setText,
  };
  const isInvalid =
    (Boolean(draft.text.trim()) && !draft.geometry) ||
    (draft.write.outcome?.kind === "failed" && draft.write.outcome.code === "invalid_geometry");
  return (
    <fieldset disabled={draft.write.isBusy} className={styles.fieldset}>
      <div className={styles.workspace}>
        <MapPanel {...map} />
        <div className={styles.content}>
          <PolygonField value={draft.text} onChange={draft.setText} isInvalid={isInvalid} />
          <ExcludedPoints draft={draft} canCreatePoint={canCreatePoint} />
        </div>
      </div>
    </fieldset>
  );
}
