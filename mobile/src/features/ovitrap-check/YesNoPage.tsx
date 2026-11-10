import { CircleCheck, CircleX } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceButton } from "../../ui/ChoiceButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";

interface Props {
  readonly title: string;
  readonly hint?: string;
  readonly value: boolean | null;
  readonly disabled: boolean;
  readonly onChoose: (value: boolean) => void;
}

/** The huge Sí / No page: "¿Está la papeleta?" and "¿Tiene huevos?". Green yes, red no, filled. */
export function YesNoPage({ title, hint, value, disabled, onChoose }: Props) {
  const t = useT();
  return (
    <>
      <StepQuestion title={title} hint={hint} />
      <View className="flex-row gap-3">
        <ChoiceButton
          tone="yes"
          icon={CircleCheck}
          label={t("courier.choice.yes")}
          isSelected={value === true}
          disabled={disabled}
          onPress={() => {
            onChoose(true);
          }}
        />
        <ChoiceButton
          tone="no"
          icon={CircleX}
          label={t("courier.choice.no")}
          isSelected={value === false}
          disabled={disabled}
          onPress={() => {
            onChoose(false);
          }}
        />
      </View>
    </>
  );
}
