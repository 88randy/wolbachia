import { useT } from "../../i18n/I18nProvider.tsx";
import { choose } from "./choices.ts";
import { YesNo } from "./YesNo.tsx";
import type { CaptureProps } from "./model.ts";
export function CheckQuestion(props: CaptureProps) {
  const { draft, model } = props;
  const t = useT();
  const isPaddle = draft.step === "paddle";
  return (
    <YesNo
      title={t(isPaddle ? "mobile.ovitrap.paddle" : "mobile.ovitrap.eggs")}
      value={isPaddle ? draft.paddlePresent : draft.hasEggs}
      disabled={model.isBusy}
      onChoose={(value) => {
        choose(props, isPaddle ? { paddlePresent: value } : { hasEggs: value });
      }}
    />
  );
}
