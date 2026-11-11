import { Flashlight, FlashlightOff } from "lucide-react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../ui/SecondaryButton.tsx";

/** Torch toggle for dark places. */
export function TorchButton({
  isOn,
  onPress,
}: {
  readonly isOn: boolean;
  readonly onPress: () => void;
}) {
  const t = useT();
  return (
    <SecondaryButton
      icon={isOn ? FlashlightOff : Flashlight}
      label={t(isOn ? "field.scan.torchOff" : "field.scan.torchOn")}
      onPress={onPress}
    />
  );
}
