/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative tab layout. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import { FolderTabs } from "../../ui/FolderTabs";
import { InlineNotice } from "../../ui/InlineNotice";
import { EvaluationAttempts } from "./EvaluationAttempts";
import { EvaluationCapture } from "./EvaluationCapture";
import { EvaluationCorrectionGap } from "./EvaluationCorrectionGap";
import { EvaluationHistory } from "./EvaluationHistory";
import { EvaluationNotice } from "./EvaluationNotice";
import { RubricLookup } from "./RubricLookup";
import type { EvaluationScope } from "./evaluation-query";

const STACK = "flex flex-col gap-4";

/** Capture, history and HR notices of the evaluations, one tab each. */
export function W51Workspace({ scope, item }: { scope: EvaluationScope; item: string }) {
  const { t } = useTranslation();
  const can = useCan();
  const canCreate = can("evaluation.create");
  const canRead = can("evaluation.read");
  const [tab, setTab] = useState(item || !canCreate ? "history" : "new");
  const history = canRead ? (
    <div className={STACK}>
      <EvaluationHistory scope={scope} />
      {item && <EvaluationAttempts scope={scope} id={item} />}
      <EvaluationCorrectionGap />
    </div>
  ) : (
    <InlineNotice tone="info">{t("evaluations.page.private")}</InlineNotice>
  );
  return (
    <FolderTabs
      label={t("evaluations.page.title")}
      value={tab}
      onValueChange={setTab}
      items={[
        {
          value: "new",
          label: t("evaluations.tab.new"),
          content: canCreate ? <EvaluationCapture scope={scope} /> : <RubricLookup scope={scope} />,
        },
        ...(canRead
          ? [
              { value: "history", label: t("evaluations.tab.history"), content: history },
              {
                value: "notice",
                label: t("evaluations.tab.notice"),
                content: <EvaluationNotice scope={scope} />,
              },
            ]
          : []),
      ]}
    />
  );
}
