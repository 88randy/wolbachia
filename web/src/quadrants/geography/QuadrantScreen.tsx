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
import { QuadrantEditor } from "./QuadrantEditor";
import { ReadOnlyQuadrantMap } from "./ReadOnlyQuadrantMap";
import { W24Page } from "./W24Page";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
  refresh: () => Promise<number | null>;
}
/** W23 record: the map editor is the main UI; raw coordinates live behind "Advanced". */
export function QuadrantScreen({ scope, quadrant, refresh }: Props) {
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
        {scope.canPublish && (
          <details className="rounded-2xl border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              {t("mapEditor.advanced")}
            </summary>
            <div className="pt-3">
              <QuadrantEditor scope={scope} quadrant={quadrant} refresh={refresh} />
            </div>
          </details>
        )}
        <RecordLabels>
          <W24Page scope={scope} quadrant={quadrant} />
        </RecordLabels>
      </section>
    </PageFrame>
  );
}
