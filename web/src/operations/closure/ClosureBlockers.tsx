import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { ClosureBlockerItem } from "./ClosureBlockerItem";
import { readinessKey } from "./closure-policy";
import type { Readiness } from "./closure-policy";
import styles from "./closure.module.css";
export function ClosureBlockers({ readiness }: { readiness: Readiness }) {
  const { t } = useTranslation();
  if (!readiness.blockers.length)
    return (
      <InlineNotice tone={readiness.is_closed ? "success" : "info"}>
        {t(readinessKey(readiness))}
      </InlineNotice>
    );
  return (
    <section aria-label={t("closure.blocker.title")}>
      <h2>{t("closure.blocker.title")}</h2>
      {readiness.is_closed && <p>{t("closure.readiness.closed")}</p>}
      <p>{t("closure.readiness.blocked")}</p>
      <ul className={styles.blockers}>
        {readiness.blockers.map((blocker, index) => (
          <ClosureBlockerItem
            key={blocker.reason + "|" + (blocker.id ?? String(index))}
            blocker={blocker}
          />
        ))}
      </ul>
    </section>
  );
}
