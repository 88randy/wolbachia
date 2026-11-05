import { RecordLabels } from "./RecordLabels";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
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
export function QuadrantScreen({ scope, quadrant, refresh }: Props) {
  const { t } = useTranslation();
  return (
    <section className={styles.page}>
      <Link to="/quadrants">{t("geography.page.back")}</Link>
      <h1>{quadrant.code}</h1>
      {scope.canPublish ? (
        <QuadrantEditor scope={scope} quadrant={quadrant} refresh={refresh} />
      ) : (
        <ReadOnlyQuadrantMap scope={scope} quadrant={quadrant} />
      )}
      <RecordLabels>
        <W24Page scope={scope} quadrant={quadrant} />
      </RecordLabels>
    </section>
  );
}
