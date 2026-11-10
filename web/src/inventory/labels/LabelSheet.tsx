import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import type { LabelKind, LabelSize } from "./label-kinds";
import type { LabelItem } from "./label-payload";
import { LabelCard } from "./LabelCard";
import styles from "./labels.module.css";

interface LabelSheetProps {
  kind: LabelKind;
  size: LabelSize;
  items: readonly LabelItem[];
}

/** Preview at real size; this is also the only part of the page that prints. */
export function LabelSheet({ kind, size, items }: LabelSheetProps) {
  const { t } = useTranslation();
  return (
    <Card title={t("inventory.labels.preview")}>
      <div className={styles["printArea"]}>
        <div className={styles["sheet"]} data-size={size}>
          {items.map((item) => (
            <LabelCard key={item.id} kind={kind} item={item} />
          ))}
        </div>
      </div>
      {items.length === 0 && (
        <p className="m-0 mt-3 text-sm text-ink-3">{t("inventory.labels.previewEmpty")}</p>
      )}
    </Card>
  );
}
