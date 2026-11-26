import { FilePlus2 } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

/** A fresh origin never changes or approves the retained original draft or its evidence. */
export function ReleaseRestart({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (!model.hasDraft || !model.canRestart || model.status !== "draft") return null;
  return (
    <>
      <InfoNotice tone="warning" message={t("mobile.release.restartHint")} />
      <SecondaryButton
        icon={FilePlus2}
        label={t("mobile.release.restart")}
        disabled={model.isBusy}
        onPress={model.restart}
      />
    </>
  );
}
