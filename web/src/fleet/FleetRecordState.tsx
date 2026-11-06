import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { CardSkeleton } from "../ui/CardSkeleton";
import { FleetLoadError } from "./FleetLoadError";
import page from "../styles/page.module.css";
export function FleetRecordState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <section className={page.page}>
      {error !== null ? (
        <Card title={t("fleet.page.title")} headingLevel={1}>
          <FleetLoadError error={error} onRetry={onRetry} />
        </Card>
      ) : (
        <CardSkeleton />
      )}
    </section>
  );
}
