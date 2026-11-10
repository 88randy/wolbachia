import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleBlockers({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.status !== "draft" || model.blockers.length === 0) return null;
  return (
    <>
      {model.blockers.map((key) => (
        <InfoNotice key={key} tone="warning" message={t(key)} />
      ))}
      <InfoNotice tone="info" message={t("mobile.sample.blockedHint")} />
    </>
  );
}
