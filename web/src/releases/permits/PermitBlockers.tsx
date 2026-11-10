import { useTranslation } from "react-i18next";
import { blockerKey } from "./permit-status";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

/** Which condition fails and who can resolve it; the roles are the API's own words (data). */
export function PermitBlockers({ blockers }: { blockers: Permit["blocked_by"] }) {
  const { t } = useTranslation();
  if (blockers.length === 0) return <span>{t("permits.requirements.met")}</span>;
  return (
    <ul className={styles.blockers}>
      {blockers.map((blocker) => (
        <li key={blocker.reason}>
          {t(blockerKey(blocker.reason))}{" "}
          <span className={styles.muted}>
            {t("permits.blocker.unblockedBy", { role: blocker.unblocked_by_role })}
          </span>
        </li>
      ))}
    </ul>
  );
}
