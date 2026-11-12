import { History, RotateCcw } from "lucide-react-native";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import type { M08Model } from "./use-m-08.ts";
import type { StaleDraft } from "./stale-draft.ts";

function when(iso: string, locale: string) {
  const date = new Date(iso);
  return {
    date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date),
    time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

/**
 * An unfinished capture from another day or a closed shift. It is never reused silently: the
 * courier says whether it was really done (it keeps its original time and the office reviews it)
 * or starts again. A capture that can no longer be saved only offers to start again.
 */
export function StaleDraftChoice({
  model,
  eventId,
  stale,
}: {
  readonly model: M08Model;
  readonly eventId: string;
  readonly stale: StaleDraft;
}) {
  const t = useT();
  const locale = useLocale();
  const { date, time } = when(stale.createdAt, locale);
  const run = (action: () => Promise<unknown>) => {
    void model.run(action, { eventId });
  };
  return (
    <ScreenScaffold header={<AppHeader title={t("field.capture.title")} />}>
      {stale.invalidReason === null ? (
        <InfoNotice tone="warning" message={t("field.stale.title", { date, time })} />
      ) : (
        <InfoNotice
          tone="warning"
          message={t("field.stale.invalid", {
            date,
            reason: t(`field.stale.reason.${stale.invalidReason}`),
          })}
        />
      )}
      <View className="gap-3">
        {stale.invalidReason === null ? (
          <ChoiceRow
            icon={History}
            label={t("field.stale.continue")}
            hint={t("field.stale.continueHint")}
            isSelected={false}
            disabled={model.isBusy}
            onPress={() => {
              run(() => model.service.continueStale(eventId));
            }}
          />
        ) : null}
        <ChoiceRow
          icon={RotateCcw}
          label={t("field.stale.restart")}
          hint={t("field.stale.restartHint")}
          isSelected={false}
          disabled={model.isBusy}
          onPress={() => {
            run(() => model.service.discardStale(eventId));
          }}
        />
      </View>
    </ScreenScaffold>
  );
}
