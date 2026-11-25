import { Route } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { DayRoute } from "./use-day-lines.ts";

/** "Ver recorrido" when the day's points are on the phone; otherwise why there is no line. */
export function DayRouteAction({
  route,
  onOpen,
}: {
  readonly route: DayRoute;
  readonly onOpen: () => void;
}) {
  const t = useT();
  if (route === "lines")
    return <SecondaryButton icon={Route} label={t("mobile.calendar.seeRoute")} onPress={onOpen} />;
  if (route === "pruned")
    return <InfoNotice tone="info" message={t("mobile.calendar.routePruned")} />;
  if (route === "none") return <InfoNotice tone="info" message={t("mobile.calendar.noRoute")} />;
  return null;
}
