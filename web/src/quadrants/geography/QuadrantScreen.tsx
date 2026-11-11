import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { List } from "lucide-react";
import type { Schemas } from "@wolbachia/api-client";
import { PageFrame } from "../../components/templates/PageFrame";
import { DetailCenter } from "../../components/templates/DetailCenter";
import { buttonVariants } from "../../ui/button-variants";
import { PageHeader } from "../../components/templates/PageHeader";
import { MapEditorWorkspace } from "../editor/MapEditorWorkspace";
import { RecordLabels } from "./RecordLabels";
import type { GeographyScope } from "./use-w-15";
import { ReadOnlyQuadrantMap } from "./ReadOnlyQuadrantMap";
import { W24Page } from "./W24Page";
import { MeasureFacts } from "./MeasureFacts";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
  refresh: () => Promise<number | null>;
}
/** W23 record: the map editor is the only editor; coordinates are never typed. */
export function QuadrantScreen({ scope, quadrant }: Props) {
  const { t } = useTranslation();
  const canEdit = scope.canPublish || scope.canCreatePoint;
  return (
    <PageFrame>
      <PageHeader
        title={quadrant.code}
        description={<DetailCenter centerId={quadrant.center} />}
        actions={
          <Link to="/quadrants" className={buttonVariants({ variant: "secondary" })}>
            <List aria-hidden="true" className="size-4" />
            {t("mapEditor.action.list")}
          </Link>
        }
      />
      <MeasureFacts version={quadrant.current_version} />
      {canEdit ? (
        <MapEditorWorkspace scope={scope} focusCode={quadrant.code} />
      ) : (
        <ReadOnlyQuadrantMap scope={scope} quadrant={quadrant} />
      )}
      <section className={styles.page}>
        <RecordLabels>
          <W24Page scope={scope} quadrant={quadrant} />
        </RecordLabels>
      </section>
    </PageFrame>
  );
}
