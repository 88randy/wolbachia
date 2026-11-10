/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { List } from "lucide-react";
import type { Schemas } from "@wolbachia/api-client";
import { centersOptions } from "../../centers/centers-query";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { MapEditorWorkspace } from "../editor/MapEditorWorkspace";
import { RecordLabels } from "./RecordLabels";
import type { GeographyScope } from "./use-w-15";
import { ReadOnlyQuadrantMap } from "./ReadOnlyQuadrantMap";
import { W24Page } from "./W24Page";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
  refresh: () => Promise<number | null>;
}
/** W23 record: the map editor is the only editor; coordinates are never typed. */
export function QuadrantScreen({ scope, quadrant }: Props) {
  const { t } = useTranslation();
  const centers = useQuery(centersOptions(scope.client, scope.identity));
  const center = centers.data?.find((item) => item.id === quadrant.center)?.name;
  const canEdit = scope.canPublish || scope.canCreatePoint;
  return (
    <PageFrame>
      <PageHeader
        title={quadrant.code}
        description={center}
        actions={
          <Link
            to="/quadrants"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-tint"
          >
            <List aria-hidden="true" className="size-4" />
            {t("mapEditor.action.list")}
          </Link>
        }
      />
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
