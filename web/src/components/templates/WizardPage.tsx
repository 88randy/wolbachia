import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { useDocumentTitle } from "../../shell/use-document-title";
import { PageFrame } from "./PageFrame";
import { PageHeader } from "./PageHeader";
import { WizardFooter } from "./WizardFooter";
import type { WizardFooterProps } from "./WizardFooter";

export interface WizardPageProps extends WizardFooterProps {
  /** Title of the whole task (e.g. "Nuevo permiso"). */
  title: string;
  /** 1-based current step and the total number of steps. */
  step: number;
  total: number;
  /** What this step asks for, in plain words. */
  stepTitle: string;
  stepDescription?: ReactNode;
  notices?: ReactNode;
  children: ReactNode;
}

/** Template 3 of 4, Wizard: "Paso X de N", a progress bar, one question per step, Back/Next. */
export function WizardPage(props: WizardPageProps) {
  const { title, step, total, stepTitle, stepDescription, notices, children } = props;
  const { t } = useTranslation();
  const stepLabel = t("common.wizard.step", { current: step, total });
  useDocumentTitle(`${stepTitle} · ${title}`);
  return (
    <PageFrame width="narrow">
      <PageHeader eyebrow={stepLabel} title={title} />
      <Progress
        value={(Math.min(step, total) / Math.max(total, 1)) * 100}
        aria-label={stepLabel}
        className="h-2 bg-tint [&>[data-slot=progress-indicator]]:bg-action"
      />
      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <header className="flex flex-col gap-1">
          <h2 className="m-0 text-lg leading-7 font-semibold">{stepTitle}</h2>
          {stepDescription && <p className="m-0 text-sm text-ink-2">{stepDescription}</p>}
        </header>
        {notices}
        {children}
        <WizardFooter {...props} />
      </section>
    </PageFrame>
  );
}
