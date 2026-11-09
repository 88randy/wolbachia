import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftStatus } from "./ShiftStatus.tsx";
import type { ShiftSnapshot } from "./service.ts";

export function HomeShiftDetails({ state }: { readonly state: ShiftSnapshot | null }) {
  const t = useT();
  if (state?.locallyClosedAt) return <AppText>{t("mobile.shiftClose.phoneClosed")}</AppText>;
  if (state?.opening) return <ShiftStatus state={state} />;
  return <AppText>{t("mobile.shiftOpen.noAssignment")}</AppText>;
}
