import { View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { causeKey, levelKey, nextKey } from "./copy.ts";
import type { GlobalState } from "./global-state.ts";

const MAX_SHOWN = 2;
const TONES = { blocking: "danger", warning: "warning", info: "info" } as const;

function stateMessage(state: GlobalState, isCalm: boolean, t: ReturnType<typeof useT>): string {
  const level = isCalm ? [] : [t(levelKey(state.level)) + "."];
  return [...level, t(causeKey(state.cause)), t(nextKey(state.nextAction))].join(" ");
}

/**
 * Shows the highest-priority global states. Each one states its cause, its level (as text, never
 * color alone) and the next action. Extra states are counted, not hidden silently.
 */
export function GlobalStateList({
  states,
  isCalm = false,
}: {
  readonly states: readonly GlobalState[];
  /** Login/unlock: a calm informational note without the alarming level word (owner, 2026-11-10). */
  readonly isCalm?: boolean;
}) {
  const t = useT();
  if (states.length === 0) return null;
  return (
    <View className="gap-2 p-2">
      {states.slice(0, MAX_SHOWN).map((state) => (
        <InfoNotice
          key={state.cause}
          tone={isCalm ? "info" : TONES[state.level]}
          message={stateMessage(state, isCalm, t)}
        />
      ))}
      {states.length > MAX_SHOWN ? (
        <AppText variant="caption">
          {t("mobile.global.more", { count: states.length - MAX_SHOWN })}
        </AppText>
      ) : null}
    </View>
  );
}
