import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";

export interface WizardFooterProps {
  /** Omit on the first step. */
  onBack?: () => void;
  onNext: () => void;
  /** Defaults to "Siguiente", and "Listo" on the last step. */
  nextLabel?: string;
  /** Blocked by state: keep the button focusable and explain why next to it. */
  isNextBlocked?: boolean;
  isBusy?: boolean;
  isLastStep?: boolean;
}

/** Back on the left, the one primary action on the right. */
export function WizardFooter(props: WizardFooterProps) {
  const { onBack, onNext, nextLabel, isNextBlocked, isBusy, isLastStep } = props;
  const { t } = useTranslation();
  return (
    <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      {onBack ? (
        <Button
          variant="ghost"
          size="lg"
          leadingIcon={<ArrowLeft aria-hidden="true" />}
          onClick={onBack}
        >
          {t("common.actions.back")}
        </Button>
      ) : (
        <span />
      )}
      <Button
        size="xl"
        className="min-w-40"
        loading={isBusy}
        aria-disabled={isNextBlocked || undefined}
        leadingIcon={isLastStep ? <Check aria-hidden="true" /> : undefined}
        onClick={onNext}
      >
        {nextLabel ?? t(isLastStep ? "common.actions.finish" : "common.actions.next")}
        {!isLastStep && <ArrowRight aria-hidden="true" />}
      </Button>
    </footer>
  );
}
