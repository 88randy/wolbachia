import { Pressable } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { createFuelStyles } from "./styles.ts";
import type { M11Model } from "./use-m-11.ts";

export function FuelRefillChoice({ model }: { readonly model: M11Model }) {
  const t = useT();
  const styles = useStyles(createFuelStyles);
  const draft = model.state?.draft;
  if (!draft) return null;
  const disabled = model.isBusy || !model.state?.ready || model.state.event !== null;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={t("mobile.fuel.fullRefill")}
      accessibilityState={{ checked: draft.isFullRefill, disabled }}
      disabled={disabled}
      onPress={() => {
        model.edit("isFullRefill", !draft.isFullRefill);
      }}
      style={[
        styles.switch,
        draft.isFullRefill ? styles.selected : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <AppText variant="bodyStrong">{t("mobile.fuel.fullRefill")}</AppText>
      <AppText>
        {t(draft.isFullRefill ? "mobile.fuel.fullRefillYes" : "mobile.fuel.fullRefillNo")}
      </AppText>
    </Pressable>
  );
}
