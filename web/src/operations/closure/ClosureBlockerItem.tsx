import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { blockerKey } from "./closure-policy";
import type { Readiness } from "./closure-policy";
export function ClosureBlockerItem({ blocker }: { blocker: Readiness["blockers"][number] }) {
  const { t } = useTranslation();
  return (
    <li>
      <InlineNotice tone="warning">
        <strong>{t(blockerKey(blocker.reason), { reason: blocker.reason })}</strong>
        <p>{t("closure.blocker.unblocker", { permission: blocker.permission })}</p>
      </InlineNotice>
    </li>
  );
}
