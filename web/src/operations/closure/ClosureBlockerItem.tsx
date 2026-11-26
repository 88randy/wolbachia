import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { blockerKey } from "./closure-policy";
import type { Readiness } from "./closure-policy";
export function ClosureBlockerItem({ blocker }: { blocker: Readiness["blockers"][number] }) {
  const { t } = useTranslation();
  const { code, link } = blocker;
  const reference = code ? t("closure.blocker.reference", { reference: code }) : null;
  // Only the incident cause has a record route; any other link is ignored, never misrouted.
  const isIncidentLink = Boolean(link) && blocker.reason === "incident_quadrant_closure";
  return (
    <li>
      <InlineNotice tone="warning">
        <strong>{t(blockerKey(blocker.reason), { reason: blocker.reason })}</strong>
        {code && (
          <p className="font-mono tabular-nums">
            {isIncidentLink ? (
              <Link to="/incidents/$code" params={{ code }}>
                {reference}
              </Link>
            ) : (
              reference
            )}
          </p>
        )}
        <p>{t("closure.blocker.unblocker", { permission: blocker.permission })}</p>
      </InlineNotice>
    </li>
  );
}
