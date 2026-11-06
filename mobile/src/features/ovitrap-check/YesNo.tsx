import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
interface Props {
  readonly title: string;
  readonly value: boolean | null;
  readonly disabled: boolean;
  readonly onChoose: (value: boolean) => void;
}
export function YesNo({ title, value, disabled, onChoose }: Props) {
  const t = useT();
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {title}
      </AppText>
      <ShiftAction
        label={t("mobile.ovitrap.yes")}
        selected={value === true}
        disabled={disabled}
        onPress={() => {
          onChoose(true);
        }}
      />
      <ShiftAction
        label={t("mobile.ovitrap.no")}
        selected={value === false}
        disabled={disabled}
        onPress={() => {
          onChoose(false);
        }}
      />
    </View>
  );
}
