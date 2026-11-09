import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { CatalogSheet } from "./CatalogSheet.tsx";
import { useCatalogChoice } from "./use-catalog-choice.ts";
import type { CatalogProps } from "./CatalogOptions.tsx";
export function CatalogChoices(props: CatalogProps & { readonly isBusy: boolean }) {
  const t = useT();
  const choices = useCatalogChoice(props);
  return (
    <View>
      <AppText>{t("mobile.lifecycle.reason")}</AppText>
      <AppText>{choices.label}</AppText>
      <ShiftAction
        label={t("mobile.lifecycle.chooseReason")}
        disabled={props.isBusy}
        onPress={choices.open}
      />
      <CatalogSheet
        items={props.items}
        code={props.code}
        choose={choices.choose}
        isOpen={choices.isOpen}
        close={choices.close}
      />
    </View>
  );
}
