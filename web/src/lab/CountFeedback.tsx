import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import type { LabFailure } from "./lab-failure";
import { ConflictCount } from "./ConflictCount";
import type { LabScope } from "./lab-query";
/** The server gate is explicit; network failures never silently become a new observation. */
export function CountFeedback({ failure, scope, code }: { failure: LabFailure | undefined; scope: LabScope; code?: string }) {
  const { t } = useTranslation();
  if (!failure) return null;
  const message = failure.kind === "conflict" ? "lab.error.conflict" : failure.kind === "uncertain" ? "lab.error.uncertain" : failure.kind === "confirm" ? "lab.count.confirmHint" : "lab.error.rejected";
  return (
    <>
      <InlineNotice tone="warning">{t(message)}</InlineNotice>
      <details><summary>{t("ui.actions.details")}</summary><code>{failure.code}</code></details>
      {failure.kind === "conflict" && code && <ConflictCount scope={scope} code={code} />}
    </>
  );
}
