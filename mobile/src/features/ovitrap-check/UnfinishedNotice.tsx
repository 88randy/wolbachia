import { useEffect, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

/** How many captures were started and not finished; follows the same updates as the capture screen. */
export function useUnfinishedCaptures(): number {
  const { ovitrapCheck, engine, shiftOpen } = useServices();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let isActive = true;
    const load = () => {
      ovitrapCheck
        .unfinishedCount()
        .then((next) => {
          if (isActive) setCount(next);
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
  return count;
}

/** "Tienes N capturas sin terminar" with the button that opens them (finish or discard). */
export function UnfinishedNotice() {
  const t = useT();
  const { push } = useNavigation();
  const count = useUnfinishedCaptures();
  if (count === 0) return null;
  return (
    <InfoNotice
      tone="warning"
      message={t("field.stale.pending", { count })}
      action={{
        label: t("field.stale.pendingAction"),
        onPress: () => {
          push({ name: "ovitrapCapture" });
        },
      }}
    />
  );
}
