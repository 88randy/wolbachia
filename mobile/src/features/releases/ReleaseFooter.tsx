import { ArrowLeft } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ReleaseSaveActions } from "./ReleaseSaveActions.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseFooter({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (model.isLoading) return null;
  if (model.status === "draft") return <ReleaseSaveActions model={model} />;
  return (
    <PrimaryButton
      icon={ArrowLeft}
      label={t("mobile.release.backToDay")}
      onPress={model.goBackToDay}
    />
  );
}
