import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import type { LabFailure } from "./lab-failure";
import { ConflictCount } from "./ConflictCount";
import type { LabScope } from "./lab-query";
const FAILURE_MESSAGES = {
  conflict: "lab.error.conflict",
  uncertain: "lab.error.uncertain",
  confirm: "lab.count.confirmHint",
  rejected: "lab.error.rejected",
} as const;
/** The server gate is explicit; network failures never silently become a new observation. */
export function CountFeedback({
  failure,
  scope,
  code,
}: {
  failure: LabFailure | undefined;
  scope: LabScope;
  code?: string;
}) {
  const { t } = useTranslation();
  if (!failure) return <div role="status" aria-atomic="true" />;
  const message = FAILURE_MESSAGES[failure.kind];
  return (
    <>
      <div role="status" aria-atomic="true">
        <InlineNotice tone="warning">{t(message)}</InlineNotice>
      </div>
      <details>
        <summary>{t("ui.actions.details")}</summary>
        <code>{failure.code}</code>
      </details>
      {failure.kind === "conflict" && code && <ConflictCount scope={scope} code={code} />}
    </>
  );
}
