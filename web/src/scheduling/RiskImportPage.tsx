import { Link } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WizardPage } from "../components/templates/WizardPage";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { buttonVariants } from "../ui/button-variants";
import { InlineNotice } from "../ui/InlineNotice";
import { failureKey } from "./use-scheduling-writes";
import { RiskImportFileStep } from "./RiskImportFileStep";
import { RiskImportPreviewStep } from "./RiskImportPreviewStep";
import { RiskImportSourceStep } from "./RiskImportSourceStep";
import { useRiskImport } from "./use-risk-import";

/** W27 import: where the categories come from, the file, and a preview before anything changes. */
export function RiskImportPage() {
  const { t } = useTranslation();
  const flow = useRiskImport();
  if (flow.isApplied) {
    return (
      <PageFrame width="narrow">
        <PageHeader title={t("scheduling.import.title")} />
        <InlineNotice tone="success">
          <p>
            <CircleCheck aria-hidden="true" className="mr-1 inline size-4" />
            {t("scheduling.import.applied", { count: flow.rows.length })}
          </p>
        </InlineNotice>
        <Link
          to="/scheduling/risk"
          search={{ week: flow.week }}
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          {t("scheduling.import.seeResult")}
        </Link>
      </PageFrame>
    );
  }
  const failure = flow.send.error ?? flow.apply.error;
  const notices = failure ? (
    <InlineNotice tone="critical">
      <p>{t(failureKey(failure))}</p>
    </InlineNotice>
  ) : undefined;
  const canApply = flow.rows.length > 0 && flow.errors.length === 0;
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
      </WizardPage>
    );
  }
  return (
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
        if (flow.preview && canApply) flow.apply.mutate(flow.preview);
      }}
    >
      <RiskImportPreviewStep flow={flow} />
    </WizardPage>
  );
}
