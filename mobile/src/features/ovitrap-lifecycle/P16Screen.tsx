import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { AdvisoryFeedback } from "./AdvisoryFeedback.tsx";
import type { LifecycleProps } from "./model.ts";

/** Move request: it is only a request; the supervisor decides. Shows the advisory sentence. */
export function P16Screen(props: LifecycleProps) {
  const t = useT();
  return (
    <>
      <InfoNotice tone="info" message={t("field.lifecycle.relocateNote")} />
      <AdvisoryFeedback {...props} />
    </>
  );
}
