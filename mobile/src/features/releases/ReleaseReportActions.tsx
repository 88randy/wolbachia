import { MessageSquareWarning, Wrench } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

/** A blocked release has no way forward on the phone: the courier tells the people who can fix it. */
export function ReleaseReportActions({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  return (
    <>
      <PrimaryButton
        icon={MessageSquareWarning}
        label={t("mobile.release.reportSupervisor")}
        onPress={model.reportSupervisor}
      />
      <SecondaryButton
        icon={Wrench}
        label={t("mobile.release.reportDevice")}
        onPress={model.reportDevice}
      />
    </>
  );
}
