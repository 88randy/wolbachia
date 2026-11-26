import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { SampleContent } from "./SampleContent.tsx";
import { SampleFooter } from "./SampleFooter.tsx";
import type { SampleViewModel } from "./view-model.ts";

/** P20 renders retained local facts; server ingestion and lab reception remain distinct. */
export function SampleView({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  return (
    <ScreenScaffold
      header={
        <AppHeader title={t("mobile.sample.title")} subtitle={t("courier.flow.sample.subtitle")} />
      }
      footer={<SampleFooter model={model} />}
    >
      <SampleContent model={model} />
    </ScreenScaffold>
  );
}
