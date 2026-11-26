import { View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { causeKey, nextKey } from "./copy.ts";
import { fixActionFor } from "./fix-action.ts";
import type { GlobalState } from "./global-state.ts";
import { useSafety } from "./SafetyProvider.tsx";

const MAX_SHOWN = 2;
const TONES = { blocking: "danger", warning: "warning", info: "info" } as const;

/**
 * Shows the highest-priority global states, one compact banner each: the cause in plain words
 * and, when the phone can fix it, a short button on the right. Extra states are counted.
 */
export function GlobalStateList({
  states,
  isCalm = false,
}: {
  readonly states: readonly GlobalState[];
  /** Login/unlock: a calm informational note (owner, 2026-11-10). */
  readonly isCalm?: boolean;
}) {
  const t = useT();
  const { recheckLocation } = useSafety();
  if (states.length === 0) return null;
  return (
    <View className="gap-2 p-2">
      {states.slice(0, MAX_SHOWN).map((state) => {
        const fix = fixActionFor(state.cause);
        const cause = t(causeKey(state.cause));
        return (
          <InfoNotice
            key={state.cause}
            tone={isCalm ? "info" : TONES[state.level]}
            message={fix ? cause : `${cause} ${t(nextKey(state.nextAction))}`}
            action={
              fix
                ? {
                    label: t(fix.labelKey),
                    onPress: () => {
                      void fix.run(recheckLocation);
                    },
                  }
                : undefined
            }
          />
        );
      })}
      {states.length > MAX_SHOWN ? (
        <AppText variant="caption">
          {t("mobile.global.more", { count: states.length - MAX_SHOWN })}
        </AppText>
      ) : null}
    </View>
  );
}
