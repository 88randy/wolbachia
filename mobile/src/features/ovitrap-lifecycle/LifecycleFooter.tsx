import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { SaveAvailability } from "./SaveAvailability.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { RemoveSheet } from "./RemoveSheet.tsx";
import { useLifecycleSave } from "./use-lifecycle-save.ts";
import type { LifecycleProps } from "./model.ts";
export function LifecycleFooter(props: LifecycleProps) {
  const { model, draft } = props;
  const t = useT();
  const styles = useStyles(createShiftStyles);
  const actions = useLifecycleSave(props);
  return (
    <View style={styles.footer}>
      <SaveAvailability isBlocked={actions.isBlocked} gate={model.state?.gate} />
      <ShiftAction
        label={t(
          draft.kind === "remove" ? "mobile.lifecycle.confirmRemove" : "mobile.lifecycle.save",
        )}
        disabled={model.isBusy || actions.isBlocked}
        onPress={actions.submit}
      />
      <RemoveSheet
        isOpen={actions.isOpen}
        close={actions.close}
        save={actions.save}
        isBusy={model.isBusy}
        draft={draft}
      />
    </View>
  );
}
