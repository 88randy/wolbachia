import { Bike } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";

/** There is no open shift: say it kindly and offer the one thing to do, open the shift. */
export function NeedShift() {
  const t = useT();
  const { push } = useNavigation();
  return (
    <ScreenScaffold header={<AppHeader title={t("field.capture.title")} />}>
      <EmptyState
        icon={Bike}
        title={t("field.capture.needShift")}
        message={t("field.capture.needShiftHint")}
        actionLabel={t("field.capture.openShift")}
        actionIcon={Bike}
        onAction={() => {
          push({ name: "openShift" });
        }}
      />
    </ScreenScaffold>
  );
}
