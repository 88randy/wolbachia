import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { qrContent, visibleText } from "./label-record";
import type { LabelRecord } from "./label-record";
import styles from "./labels.module.css";

/** One physical label: the QR on the left, the code in large text and up to two context lines. */
export function LabelItem({ record }: { record: LabelRecord }) {
  const { t } = useTranslation();
  const { heading, lines } = visibleText(record);
  return (
    <div className={styles["label"]} data-testid="label">
      <QRCodeSVG
        className={styles["qr"]}
        value={qrContent(record)}
        level="M"
        marginSize={2}
        fgColor="black"
        bgColor="white"
        title={t("labels.qr.alt", { code: heading })}
      />
      <div className={styles["text"]}>
        <span className={styles["code"]}>{heading}</span>
        {lines.slice(0, 2).map((line) => (
          <span key={line} className={styles["line"]}>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
