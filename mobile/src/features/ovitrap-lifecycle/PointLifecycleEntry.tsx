import { MoveRight, Replace, Trash2 } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M08Model } from "../ovitrap-check/use-m-08.ts";

/** After a capture: replace this trap, ask to move it, or retire it. */
export function PointLifecycleEntry({ model }: { readonly model: M08Model }) {
  const t = useT();
  const { push } = useNavigation();
  const draft = model.state?.draft;
  const ovitrapId = model.state?.lifecycleTargetId;
  if (!model.state || !ovitrapId || !draft?.point) return null;
  if (draft.mode !== "check" && !model.state.event) return null;
  const manualCapture = draft.manualCapture;
  return (
    <>
      <AppText variant="bodyStrong" tone="secondary">
        {t("field.capture.moreActions")}
      </AppText>
      <SecondaryButton
        icon={Replace}
        label={t("field.lifecycle.kind.replace")}
        onPress={() => {
          push({ name: "ovitrapReplace", ovitrapId, manualCapture });
        }}
      />
      <SecondaryButton
        icon={MoveRight}
        label={t("field.lifecycle.kind.relocate")}
        onPress={() => {
          push({ name: "ovitrapRelocate", ovitrapId, manualCapture });
        }}
      />
      <SecondaryButton
        icon={Trash2}
        label={t("field.lifecycle.kind.remove")}
        onPress={() => {
          push({ name: "ovitrapRemove", ovitrapId, manualCapture });
        }}
      />
    </>
  );
}
