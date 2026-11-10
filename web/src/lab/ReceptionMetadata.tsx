import { useTranslation } from "react-i18next";
import { ErrorState } from "../ui/ErrorState";
import { Refreshing } from "../ui/Refreshing";
import { Skeleton } from "../ui/Skeleton";
import { useReceptionMetadata, useReceptionMetadataFacts } from "./reception-metadata";
import styles from "./reception-metadata.module.css";

interface ReceptionMetadataProps {
  bagId?: string | null;
  readingId: string;
}

export function ReceptionMetadata({ bagId, readingId }: ReceptionMetadataProps) {
  const { t } = useTranslation();
  const metadata = useReceptionMetadata(readingId, bagId);
  const facts = useReceptionMetadataFacts(metadata, readingId);
  return (
    <div className={styles.content}>
      {metadata.isLimited && <p className={styles.hint}>{t("labReception.metadata.limited")}</p>}
      <dl className={styles.facts} aria-busy={metadata.isLoading}>
        {facts.map(([key, value]) => (
          <div key={key}>
            <dt>{t(`labReception.table.${key}`)}</dt>
            <dd>{metadata.isLoading && !metadata.reading ? <Skeleton /> : value}</dd>
          </div>
        ))}
      </dl>
      {metadata.isRefreshing && <Refreshing />}
      {metadata.error && (
        <ErrorState
          onRetry={metadata.retry}
          code={metadata.errorCode}
          message={t("labReception.metadata.unavailable")}
        />
      )}
    </div>
  );
}
