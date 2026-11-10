import type { ReactNode } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { SaveFeedback } from "./SaveFeedback.tsx";
import type { Step } from "./domain.ts";
import type { M04Model } from "./use-m-04.ts";

export const OPEN_STEPS: readonly Step[] = ["motorcycle", "checklist", "odometer", "maps"];

interface Props {
  readonly model: M04Model;
  readonly step: Step;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

/** Page of one opening step: "Paso X de 4", back goes one step back, the footer holds the one action. */
export function OpenFrame({ model, step, footer, children }: Props) {
  const t = useT();
  const index = OPEN_STEPS.indexOf(step);
  const previous = OPEN_STEPS[index - 1];
  const goPrevious =
    previous === undefined
      ? undefined
      : () => {
          void model.run(() => model.service.update({ step: previous }));
        };
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t("field.open.title")}
          step={{ current: index + 1, total: OPEN_STEPS.length }}
          onBack={goPrevious}
        />
      }
      footer={footer}
    >
      <SaveFeedback model={model} />
      {children}
    </ScreenScaffold>
  );
}
