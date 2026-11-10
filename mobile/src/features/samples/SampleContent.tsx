import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { SampleBlockers } from "./SampleBlockers.tsx";
import { SampleDrafts } from "./SampleDrafts.tsx";
import { SampleFeedback } from "./SampleFeedback.tsx";
import { SampleFields } from "./SampleFields.tsx";
import { SampleLoading } from "./SampleLoading.tsx";
import { SampleLocation } from "./SampleLocation.tsx";
import { SamplePhoto } from "./SamplePhoto.tsx";
import { SampleReferences } from "./SampleReferences.tsx";
import { SampleReminder } from "./SampleReminder.tsx";
import { SampleSelection } from "./SampleSelection.tsx";
import { SampleStatus } from "./SampleStatus.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleContent({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.isLoading) return <SampleLoading />;
  return (
    <>
      <SampleFeedback model={model} />
      <SampleStatus model={model} />
      <SampleReminder model={model} />
      <SampleDrafts model={model} />
      <SampleSelection model={model} />
      <SampleBlockers model={model} />
      {model.hasDraft ? <SampleReferences model={model} /> : null}
      {model.hasDraft ? (
        <SampleFields model={model} />
      ) : (
        <Notice tone="info" icon="clock" message={t("mobile.sample.beginHint")} />
      )}
      {model.hasDraft ? <SampleLocation model={model} /> : null}
      {model.hasDraft ? <SamplePhoto model={model} /> : null}
    </>
  );
}
