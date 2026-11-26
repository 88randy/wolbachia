import { LABEL_FORMAT_SPECS } from "./label-formats";
import type { LabelFormat } from "./label-formats";
import type { LabelRecord } from "./label-record";
import { LabelItem } from "./LabelItem";
import { paginate } from "./plan-labels";
import styles from "./labels.module.css";

interface LabelSheetProps {
  format: LabelFormat;
  labels: readonly LabelRecord[];
  /** `preview` is drawn inside the dialog (scaled to fit); `print` is the real page. */
  mode: "preview" | "print";
}

/** The labels laid out in printed pages of the chosen format. Preview and print share it. */
export function LabelSheet({ format, labels, mode }: LabelSheetProps) {
  const pages = paginate(labels, LABEL_FORMAT_SPECS[format].perPage);
  return (
    <div className={styles["sheet"]} data-format={format} data-mode={mode}>
      {pages.map((page, index) => (
        <div key={index} className={styles["page"]}>
          {page.map((record, position) => (
            <LabelItem key={`${record.code}-${String(position)}`} record={record} />
          ))}
        </div>
      ))}
    </div>
  );
}
