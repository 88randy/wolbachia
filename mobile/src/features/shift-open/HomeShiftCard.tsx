import { Button } from "../../ui/Button.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { ShiftStatus } from "./ShiftStatus.tsx";
import type { ShiftSnapshot } from "./service.ts";
export function HomeShiftCard({ state }: { readonly state: ShiftSnapshot | null }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <Card>
      <AppText variant="button">
        {t(state?.locallyClosedAt ? "mobile.shiftClose.closedTitle" : state?.opening ? "mobile.shiftOpen.opened" : "mobile.shiftOpen.noShift")}
      </AppText>
      {state?.opening && !state.locallyClosedAt && state.opening.status !== "rejected" ? (
        <Button
          label={t("mobile.day.open")}
          onPress={() => {
            push({ name: "day" });
          }}
        />
      ) : null}
      {state?.locallyClosedAt ? <AppText>{t("mobile.shiftClose.phoneClosed")}</AppText> : state?.opening ? (
        <ShiftStatus state={state} />
      ) : (
        <AppText>{t("mobile.shiftOpen.noAssignment")}</AppText>
      )}
    </Card>
  );
}
