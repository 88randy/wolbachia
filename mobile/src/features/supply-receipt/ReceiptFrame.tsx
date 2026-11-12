import type { ReactNode } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import type { M05Model } from "./use-m-05.ts";

export const RECEIPT_STEPS = 3;

interface Props {
  readonly model: M05Model;
  /** 1..3 inside a receipt; omit while the delivery is still being chosen. */
  readonly step?: number;
  readonly onBack?: (() => void) | null;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/** Page of the supplies receipt: header with "Paso X de 3", problems in plain words, one action. */
export function ReceiptFrame({ model, step, onBack, footer, children }: Props) {
  const t = useT();
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t("field.receipt.title")}
          step={step === undefined ? undefined : { current: step, total: RECEIPT_STEPS }}
          onBack={onBack}
        />
      }
      footer={footer}
    >
      {model.errorKey ? <InfoNotice tone="danger" message={t(model.errorKey)} /> : null}
      {model.state?.feedback === "invalid" ? (
        <InfoNotice tone="warning" message={t("field.receipt.invalidCode")} />
      ) : null}
      {children}
    </ScreenScaffold>
  );
}
