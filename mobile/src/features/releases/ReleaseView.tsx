import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { ReleaseContent } from "./ReleaseContent.tsx";
import { ReleaseFooter } from "./ReleaseFooter.tsx";
import { hasBlockedReleaseGate } from "./view-model.ts";
import type { ReleaseViewModel } from "./view-model.ts";

/** P18/P19: the checks the app already made, the sachets to release and the photo. */
export function ReleaseView({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  const titleKey =
    model.status === "draft" && hasBlockedReleaseGate(model.gates)
      ? "mobile.release.blockedTitle"
      : "mobile.release.title";
  return (
    <ScreenScaffold
      header={<AppHeader title={t(titleKey)} subtitle={t("courier.flow.release.subtitle")} />}
      footer={<ReleaseFooter model={model} />}
    >
      <ReleaseContent model={model} />
    </ScreenScaffold>
  );
}
