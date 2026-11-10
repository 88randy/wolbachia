import type { MessageKey } from "@wolbachia/i18n";
import { Button } from "../../ui/Button.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { HomeShiftDetails } from "./HomeShiftDetails.tsx";
import type { ShiftSnapshot } from "./service.ts";

function shiftTitleKey(state: ShiftSnapshot | null): MessageKey {
  if (state?.locallyClosedAt) return "mobile.shiftClose.closedTitle";
  return state?.opening ? "mobile.shiftOpen.opened" : "mobile.shiftOpen.noShift";
}

export function HomeShiftCard({ state }: { readonly state: ShiftSnapshot | null }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <Card>
      <AppText variant="button">{t(shiftTitleKey(state))}</AppText>
      {state?.opening && !state.locallyClosedAt && state.opening.status !== "rejected" ? (
        <Button
          label={t("mobile.day.open")}
          onPress={() => {
            push({ name: "day" });
          }}
        />
      ) : null}
      <HomeShiftDetails state={state} />
    </Card>
  );
}
