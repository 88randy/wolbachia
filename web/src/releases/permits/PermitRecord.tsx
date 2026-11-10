import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import page from "../../styles/page.module.css";
import { PermitActions } from "./PermitActions";
import { PermitBlockedBanner } from "./PermitBlockedBanner";
import { PermitFacts } from "./PermitFacts";
import { permitStatus } from "./permit-status";
import { PermitStatusBadge } from "./PermitStatusBadge";
import { PermitSuspension } from "./PermitSuspension";
import { PermitZone } from "./PermitZone";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

/** W45 body: identity and status, blockers, facts, official zone and the suspension, if any. */
export function PermitRecord({ permit }: { permit: Permit }) {
  const { t } = useTranslation();
  useDocumentTitle(permit.code);
  const version = permit.current_version;
  return (
    <section className={page.page}>
      <nav aria-label={t("permits.detail.back")}>
        <Link to="/releases/permits">{t("permits.detail.back")}</Link>
      </nav>
      <div className={styles.header}>
        <h1 className={page.title}>
          {permit.code} <PermitStatusBadge status={permitStatus(permit.blocked_by)} />
        </h1>
        <PermitActions permit={permit} />
      </div>
      <PermitBlockedBanner blockers={permit.blocked_by} />
      {version ? (
        <PermitFacts permit={permit} version={version} />
      ) : (
        <p>{t("permits.detail.noVersion")}</p>
      )}
      <PermitZone geometry={version?.geometry} />
      {permit.suspension && <PermitSuspension suspension={permit.suspension} />}
    </section>
  );
}
