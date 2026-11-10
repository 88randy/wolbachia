import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./data-table.module.css";
import type { VoidInfo } from "./table-types";
import { NO_NAME } from "../lookups/use-reference-names";

const ID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An author is a name; an id that slipped through reads "—". */
function readableAuthor(author: string): string {
  return author.trim() === "" || ID_LIKE.test(author.trim()) ? NO_NAME : author;
}

/**
 * Badge, reason and author of a voided record, written out under the row's first cell. The
 * design shows them on hover or focus; they are always visible here because content that only
 * appears on hover is out of reach for keyboard and touch users (WCAG 1.4.13).
 */
export function VoidedDetail({ info }: { info: VoidInfo }) {
  const { t } = useTranslation();
  return (
    <div className={styles.voidDetail}>
      <span className={styles.badge}>
        <Ban className={styles.badgeIcon} aria-hidden="true" />
        {t("table.voided.badge")}
      </span>
      <span className={styles.voidReason}>
        <span>{t("table.voided.reason", { reason: info.reason })}</span>
        {info.note !== undefined && <span>{info.note}</span>}
      </span>
      <span>{t("table.voided.author", { author: readableAuthor(info.author) })}</span>
      {info.when !== undefined && <span>{t("table.voided.when", { when: info.when })}</span>}
    </div>
  );
}
