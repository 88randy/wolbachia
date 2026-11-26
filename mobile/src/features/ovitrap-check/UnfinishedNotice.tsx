import { useEffect, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

/** How many captures were started and not finished; follows the same updates as the capture screen. */
export function useUnfinishedCaptures(): { count: number; isDiscardOnly: boolean } {
  const { ovitrapCheck, engine, shiftOpen } = useServices();
  const [summary, setSummary] = useState({ count: 0, isDiscardOnly: false });
  useEffect(() => {
    let isActive = true;
    const load = () => {
      ovitrapCheck
        .unfinishedSummary()
        .then((next) => {
          if (isActive) setSummary(next);
        })
        .catch(() => undefined);
    };
    load();
    const stops = [engine.subscribe(load), shiftOpen.subscribe(load)];
    return () => {
      isActive = false;
      for (const stop of stops) stop();
    };
  }, [ovitrapCheck, engine, shiftOpen]);
  return summary;
}

/** "Tienes N capturas sin terminar" with the button that opens them (finish or discard). */
export function UnfinishedNotice() {
  const t = useT();
  const { push } = useNavigation();
  const { count, isDiscardOnly } = useUnfinishedCaptures();
  if (count === 0) return null;
  return (
    <InfoNotice
      tone="warning"
      message={t(isDiscardOnly ? "field.stale.pendingBlocked" : "field.stale.pending", { count })}
      action={{
        label: t("field.stale.pendingAction"),
        onPress: () => {
          push({ name: "ovitrapCapture" });
        },
      }}
    />
  );
}
