import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

interface Props {
  readonly model: ReleaseViewModel;
  readonly disabled: boolean;
}
export function ReleaseQuantity({ model, disabled }: Props) {
  const t = useT();
  const hint = model.quantityErrorKey
    ? t(model.quantityErrorKey)
    : t("mobile.release.quantityHint");
  const input = {
    value: model.quantity,
    editable: !disabled,
    onChangeText: model.changeQuantity,
    onBlur: model.blurQuantity,
    accessibilityState: { disabled },
    accessibilityHint: hint,
  };
  return (
    <>
      <AppText>{t("mobile.release.quantity")}</AppText>
      <TextField label={t("mobile.release.quantity")} keyboardType="decimal-pad" {...input} />
      <AppText variant="caption" accessibilityLiveRegion="polite">
        {hint}
      </AppText>
    </>
  );
}
