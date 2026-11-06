import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { M06Model } from "./use-m-06.ts";
import { locationMessage } from "./location-presentation.ts";
export function LocationNotice({ model }: { readonly model: M06Model }) {
  const t = useT();
  const message = locationMessage({
    state: model.location,
    now: model.now,
    maxAccuracyM: model.state?.maxGpsAccuracyM ?? null,
  });
  return <Notice tone="info" icon="location" message={t(message.key, message.params)} />;
}
