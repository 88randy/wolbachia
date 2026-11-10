import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M04Model } from "./use-m-04.ts";

/** A save problem in plain words with one button to try again. */
export function SaveFeedback({ model }: { readonly model: M04Model }) {
  const t = useT();
  if (model.errorKey === null) return null;
  return (
    <>
      <InfoNotice tone="danger" message={t("field.open.saveProblem")} />
      <SecondaryButton
        icon={RotateCw}
        label={t("field.action.retry")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => Promise.resolve());
        }}
      />
    </>
  );
}
