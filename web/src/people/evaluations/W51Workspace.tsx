/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative tab layout. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "../../session/use-can";
import { InlineNotice } from "../../ui/InlineNotice";
import { EvaluationAttempts } from "./EvaluationAttempts";
import { EvaluationCapture } from "./EvaluationCapture";
import { EvaluationCorrectionGap } from "./EvaluationCorrectionGap";
import { EvaluationHistory } from "./EvaluationHistory";
import { EvaluationNotice } from "./EvaluationNotice";
import { RubricLookup } from "./RubricLookup";
import type { EvaluationScope } from "./evaluation-query";

type TabId = "new" | "history" | "notice";

/** Capture, history and HR notices of the evaluations, one tab each. */
export function W51Workspace({ scope, item }: { scope: EvaluationScope; item: string }) {
  const { t } = useTranslation();
  const can = useCan();
  const canCreate = can("evaluation.create");
  const canRead = can("evaluation.read");
  const [tab, setTab] = useState<TabId>(item || !canCreate ? "history" : "new");
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        setTab(next as TabId);
      }}
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="new">{t("evaluations.tab.new")}</TabsTrigger>
        {canRead && <TabsTrigger value="history">{t("evaluations.tab.history")}</TabsTrigger>}
        {canRead && <TabsTrigger value="notice">{t("evaluations.tab.notice")}</TabsTrigger>}
      </TabsList>
      <TabsContent value="new" className="flex flex-col gap-4">
        {canCreate ? <EvaluationCapture scope={scope} /> : <RubricLookup scope={scope} />}
      </TabsContent>
      <TabsContent value="history" className="flex flex-col gap-4">
        {canRead ? (
          <>
            <EvaluationHistory scope={scope} />
            {item && <EvaluationAttempts scope={scope} id={item} />}
            <EvaluationCorrectionGap />
          </>
        ) : (
          <InlineNotice tone="info">{t("evaluations.page.private")}</InlineNotice>
        )}
      </TabsContent>
      <TabsContent value="notice">
        <EvaluationNotice scope={scope} />
      </TabsContent>
    </Tabs>
  );
}
