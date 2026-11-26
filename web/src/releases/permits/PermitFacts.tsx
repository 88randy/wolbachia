import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useFormatDateTime, useFormatValidityEnd } from "../../format/use-format-date-time";
import { PermitDocumentDownload } from "./PermitDocumentDownload";
import { factRows } from "./permit-fact-rows";
import type { Permit, PermitVersion } from "./permits-query";
import styles from "./permits.module.css";

/** Identity, validity and requirements of the current official version, and its document. */
export function PermitFacts({ permit, version }: { permit: Permit; version: PermitVersion }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const formatEnd = useFormatValidityEnd();
  return (
    <dl className={styles.facts}>
      {factRows({ permit, version, t, format, formatEnd }).map(([label, value]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
      <dt>{t("permits.detail.revision", { revision: version.revision })}</dt>
      <dd>
        <PermitDocumentDownload
          permitId={permit.id}
          revision={version.revision}
          fileName={`${permit.code}-${String(version.revision)}`}
        />
      </dd>
    </dl>
  );
}
