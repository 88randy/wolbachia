/* eslint-disable max-lines-per-function, complexity -- the wizard's step machine and submission in one place. */
import { ApiError, unwrap } from "@wolbachia/api-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WizardPage } from "../../components/templates/WizardPage";
import { InlineNotice } from "../../ui/InlineNotice";
import { checkAvailability } from "../platform-queries";
import type { ProvisionResponse } from "../platform-queries";
import { usePlatformAction, usePlatformScope } from "../use-platform";
import { StepReview } from "./StepReview";
import { WizardDone } from "./WizardDone";
import { StepAdmin, StepCenters, StepData, StepRegion } from "./WizardSteps";
import {
  initialDraft,
  STEP_COUNT,
  stepOfServerField,
  toProvisionBody,
  validateStep,
} from "./wizard-draft";
import type { DraftErrors, OrganizationDraft } from "./wizard-draft";

const STEP_KEYS = ["data", "region", "centers", "admin", "review"] as const;

/** "Nueva organización": five steps, then the success screen with next steps. */
export function NewOrganizationWizard() {
  const { t } = useTranslation();
  const { client } = usePlatformScope();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OrganizationDraft>(initialDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [isChecking, setIsChecking] = useState(false);
  const [created, setCreated] = useState<ProvisionResponse | null>(null);
  const create = usePlatformAction({
    run: async (body: OrganizationDraft, signal) =>
      unwrap(
        await client.POST("/api/v1/platform/organizations/", {
          body: toProvisionBody(body),
          signal,
        }),
      ),
  });

  if (created) return <WizardDone result={created} />;

  const change = (patch: Partial<OrganizationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  /** The server is the final word on unique slug/username; ask before moving on. */
  const checkUnique = async (): Promise<DraftErrors> => {
    if (step !== 1 && step !== 4) return {};
    setIsChecking(true);
    try {
      const answer = await checkAvailability(
        client,
        step === 1 ? { slug: draft.slug } : { username: draft.username },
      );
      if (step === 1 && answer.slug_available === false)
        return { slug: "platform.field.slugTaken" };
      if (step === 4 && answer.username_available === false)
        return { username: "platform.field.usernameTaken" };
      return {};
    } catch {
      return {};
    } finally {
      setIsChecking(false);
    }
  };

  const submit = () => {
    create.submit(draft, (result) => {
      setCreated(result);
    });
  };

  const next = async () => {
    const local = validateStep(step, draft);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    if (step === STEP_COUNT) {
      submit();
      return;
    }
    const remote = await checkUnique();
    if (Object.keys(remote).length > 0) {
      setErrors(remote);
      return;
    }
    setStep(step + 1);
  };

  const serverError = (() => {
    const error = create.error;
    if (!(error instanceof ApiError)) return undefined;
    const [field, list] = Object.entries(error.envelope?.fields ?? {})[0] ?? [];
    if (!field || !list?.[0]) return undefined;
    return stepOfServerField(field, list[0].code);
  })();

  const key = STEP_KEYS[step - 1] ?? "review";
  const stepProps = { draft, errors, onChange: change };
  return (
    <WizardPage
      title={t("platform.wizard.title")}
      step={step}
      total={STEP_COUNT}
      stepTitle={t(`platform.step.${key}.title`)}
      stepDescription={t(`platform.step.${key}.description`)}
      onBack={
        step > 1
          ? () => {
              setErrors({});
              setStep(step - 1);
            }
          : undefined
      }
      onNext={() => {
        void next();
      }}
      isBusy={isChecking || create.isBusy}
      isLastStep={step === STEP_COUNT}
      nextLabel={step === STEP_COUNT ? t("platform.wizard.create") : undefined}
      notices={
        step === STEP_COUNT && create.hasFailed ? (
          <InlineNotice tone="critical">
            {serverError ? t(serverError.key) : t("platform.wizard.failed")}
          </InlineNotice>
        ) : undefined
      }
    >
      {step === 1 && <StepData {...stepProps} />}
      {step === 2 && <StepRegion {...stepProps} />}
      {step === 3 && <StepCenters {...stepProps} />}
      {step === 4 && <StepAdmin {...stepProps} />}
      {step === 5 && (
        <StepReview
          draft={draft}
          onEdit={(target) => {
            create.reset();
            if (serverError) setErrors({ [serverError.field]: serverError.key });
            setStep(target);
          }}
        />
      )}
    </WizardPage>
  );
}
