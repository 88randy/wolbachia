import { Ban } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import styles from "./voided.module.css";
import { useReveal } from "./use-reveal";
import type { VoidInfo } from "./void-info";

/**
 * "Voided" badge (icon + word, never color alone) that is a button, so a keyboard user can reach
 * it. The reason, the author and the date show on hover or focus; they are also the badge's
 * accessible description, so a screen reader reads them with it without having to reveal anything.
 */
export function VoidedBadge({ info }: { info: VoidInfo }) {
  const { t } = useTranslation();
  const detailId = useId();
  const { isOpen, wrapperProps } = useReveal();
  return (
    <span className={styles.wrapper} {...wrapperProps}>
      <button type="button" className={styles.badge} aria-describedby={detailId}>
        <Ban className={styles.icon} aria-hidden="true" />
        {t("voiding.mark.badge")}
      </button>
      <span id={detailId} className={styles.detail} hidden={!isOpen}>
        <span>{t("voiding.mark.reason", { reason: info.reason })}</span>
        <span>{t("voiding.mark.author", { author: info.author })}</span>
        {info.when !== undefined && <span>{t("voiding.mark.when", { when: info.when })}</span>}
      </span>
    </span>
  );
}
