import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WizardPage } from "../components/templates/WizardPage";
import { InlineNotice } from "../ui/InlineNotice";
import { ConfirmApply } from "./ConfirmApply";
import { ImportStepper } from "./ImportStepper";
import { RiskImportDone } from "./RiskImportDone";
import { RiskImportFileStep } from "./RiskImportFileStep";
import { RiskImportPreviewStep } from "./RiskImportPreviewStep";
import { RiskImportSourceStep } from "./RiskImportSourceStep";
import { useRiskImport } from "./use-risk-import";
import { failureKey } from "./use-scheduling-writes";
import { weekNumberOf } from "./week-dates";

/** W27 import: where the list comes from, the file, and a preview before anything changes. */
export function RiskImportPage() {
  const { t } = useTranslation();
  const flow = useRiskImport();
  const [isConfirming, setIsConfirming] = useState(false);
  if (flow.isApplied) return <RiskImportDone count={flow.rows.length} week={flow.week} />;
  const failure = flow.send.error ?? flow.apply.error;
  const canApply = flow.rows.length > 0 && flow.errors.length === 0;
  const notices = (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-ink-2">{t("scheduling.import.subtitle")}</p>
      <ImportStepper step={flow.step} />
      {failure && (
        <InlineNotice tone="critical">
          <p>{t(failureKey(failure))}</p>
        </InlineNotice>
      )}
    </div>
  );
  const common = { title: t("scheduling.import.title"), total: 3, notices };
  if (flow.step === 1) {
    return (
      <WizardPage
        {...common}
        step={1}
        stepTitle={t("scheduling.import.step1")}
        stepDescription={t("scheduling.import.step1Hint")}
        onNext={() => {
          flow.setStep(2);
        }}
      >
        <RiskImportSourceStep flow={flow} />
      </WizardPage>
    );
  }
  if (flow.step === 2) {
    return (
      <WizardPage
        {...common}
        step={2}
        stepTitle={t("scheduling.import.step2")}
        stepDescription={t("scheduling.import.step2Hint")}
        onBack={() => {
          flow.setStep(1);
        }}
        isNextBlocked={flow.file === null}
        isBusy={flow.send.isPending}
        nextLabel={t("scheduling.import.preview")}
        onNext={() => {
          if (flow.file) flow.send.mutate(flow.file);
        }}
      >
        <RiskImportFileStep flow={flow} />
        {flow.file === null && (
          <p className="m-0 text-[13px] text-ink-2">{t("scheduling.import.needFile")}</p>
        )}
      </WizardPage>
    );
  }
  return (
    <>
      <WizardPage
        {...common}
        step={3}
        isLastStep
        stepTitle={t("scheduling.import.step3")}
        stepDescription={t("scheduling.import.step3Hint")}
        onBack={flow.reset}
        isNextBlocked={!canApply}
        isBusy={flow.apply.isPending}
        nextLabel={t("scheduling.import.apply")}
        onNext={() => {
          if (canApply) setIsConfirming(true);
        }}
      >
        <RiskImportPreviewStep flow={flow} />
      </WizardPage>
      <ConfirmApply
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title={t("scheduling.import.confirmTitle", { week: weekNumberOf(flow.week) })}
        consequence={t("scheduling.import.confirmText", { count: flow.rows.length })}
        actionLabel={t("scheduling.import.apply")}
        onConfirm={() => {
          if (flow.preview) flow.apply.mutate(flow.preview);
        }}
      />
    </>
  );
}
