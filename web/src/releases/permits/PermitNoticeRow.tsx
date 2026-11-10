import { useTranslation } from "react-i18next";
import { useFormatNumber } from "../../format/use-formatters";
import { StatusPill } from "../../ui/StatusPill";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

type Notice = NonNullable<Permit["suspension"]>["notices"][number];

/** One recipient kind and its outcome: text plus icon through the pill, never only a color. */
export function PermitNoticeRow({ notice }: { notice: Notice }) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const isRecorded = notice.status === "recorded";
  const kind = notice.kind === "courier" ? "Courier" : "Coordinator";
  return (
    <tr>
      <td>{t(`permits.notice.kind${kind}`)}</td>
      <td>
        <StatusPill tone={isRecorded ? "info" : "warning"}>
          {t(`permits.notice.status${isRecorded ? "Recorded" : "DeliveryUnavailable"}`)}
        </StatusPill>
      </td>
      <td className={styles.number}>{formatNumber(notice.count)}</td>
    </tr>
  );
}
