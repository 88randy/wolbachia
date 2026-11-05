import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { ShiftStatus } from "./ShiftStatus.tsx";
import type { ShiftSnapshot } from "./service.ts";
export function HomeShiftCard({ state }: { readonly state: ShiftSnapshot | null }) {
  const t = useT();
  return (
    <Card>
      <AppText variant="button">
        {t(state?.opening ? "mobile.shiftOpen.opened" : "mobile.shiftOpen.noShift")}
      </AppText>
      {state?.opening ? (
        <ShiftStatus state={state} />
      ) : (
        <AppText>{t("mobile.shiftOpen.noAssignment")}</AppText>
      )}
    </Card>
  );
}
