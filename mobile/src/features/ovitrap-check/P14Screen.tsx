import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { choose } from "./choices.ts";
import { CheckDetails } from "./CheckDetails.tsx";
import { Confirmation } from "./Confirmation.tsx";
import { CheckQuestion } from "./CheckQuestion.tsx";
import type { CaptureProps } from "./model.ts";
/** P14 adds the conditional boolean eggs step missing from the design board. */
export function P14Screen(props: CaptureProps) {
  const { draft, model } = props;
  const t = useT();
  const locale = useLocale();
  if (draft.step === "paddle" || draft.step === "eggs") return <CheckQuestion {...props} />;
  if (draft.step === "details") return <CheckDetails {...props} />;
  if (draft.step === "confirm") return <Confirmation {...props} />;
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.ovitrap.finding")}
      </AppText>
      {draft.catalog?.findings.map((item) => (
        <ShiftAction
          key={item.code}
          label={locale === "en" ? item.label_en || item.label_es : item.label_es}
          selected={draft.finding === item.code}
          disabled={model.isBusy}
          onPress={() => {
            choose(props, { finding: item.code });
          }}
        />
      ))}
    </View>
  );
}
