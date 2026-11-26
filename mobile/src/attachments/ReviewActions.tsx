import { Check, RotateCcw } from "lucide-react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { PrimaryButton } from "../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../ui/SecondaryButton.tsx";

/** After the shot: keep the photo or take it again. */
export function ReviewActions({
  onUse,
  retake,
}: {
  readonly onUse: () => void;
  readonly retake: () => void;
}) {
  const t = useT();
  return (
    <>
      <PrimaryButton icon={Check} label={t("mobile.camera.use")} onPress={onUse} />
      <SecondaryButton icon={RotateCcw} label={t("mobile.camera.retake")} onPress={retake} />
    </>
  );
}
