import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import type { LabelKind } from "./label-kinds";
import { LABEL_KIND_SPECS } from "./label-kinds";
import type { LabelItem } from "./label-payload";
import { qrPayload } from "./label-payload";
import styles from "./labels.module.css";

/** One physical label: the QR on the left, human code, caption and type on the right. */
export function LabelCard({ kind, item }: { kind: LabelKind; item: LabelItem }) {
  const { t } = useTranslation();
  return (
    <div className={styles["label"]}>
      <QRCodeSVG
        className={styles["qr"]}
        value={qrPayload(kind, item.id)}
        level="M"
        marginSize={0}
        fgColor="black"
        bgColor="white"
        title={t("inventory.labels.qrAlt", { code: item.code })}
      />
      <div className={styles["text"]}>
        <span className={styles["code"]}>{item.code}</span>
        {item.caption && <span className={styles["caption"]}>{item.caption}</span>}
        <span className={styles["kind"]}>{t(LABEL_KIND_SPECS[kind].labelKey)}</span>
      </div>
    </div>
  );
}
