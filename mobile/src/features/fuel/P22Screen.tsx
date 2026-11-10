import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { FuelBody } from "./FuelBody.tsx";
import { FuelFeedback } from "./FuelFeedback.tsx";
import { FuelFooter } from "./FuelFooter.tsx";
import { FuelInboxLink } from "./FuelInboxLink.tsx";
import { useM11 } from "./use-m-11.ts";

/** P22 separates retained quantities, receipt transport and later server review. */
export function P22Screen() {
  const model = useM11();
  const t = useT();
  return (
    <ScreenScaffold
      header={
        <AppHeader title={t("mobile.fuel.title")} subtitle={t("courier.flow.fuel.subtitle")} />
      }
      footer={<FuelFooter model={model} />}
    >
      <FuelFeedback model={model} />
      <FuelBody model={model} />
      <FuelInboxLink model={model} />
    </ScreenScaffold>
  );
}
