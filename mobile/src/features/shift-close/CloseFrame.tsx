import type { ReactNode } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { UnfinishedNotice } from "../ovitrap-check/UnfinishedNotice.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";

interface Props {
  readonly step?: { readonly current: number; readonly total: number };
  readonly onBack?: (() => void) | null;
  readonly hasError: boolean;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/** Page of the closing wizard. */
export function CloseFrame({ step, onBack, hasError, footer, children }: Props) {
  const t = useT();
  return (
    <ScreenScaffold
      header={<AppHeader title={t("field.close.title")} step={step} onBack={onBack} />}
      footer={footer}
    >
      {hasError ? <InfoNotice tone="danger" message={t("field.close.problem")} /> : null}
      <UnfinishedNotice />
      {children}
    </ScreenScaffold>
  );
}
