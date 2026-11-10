import { StyleSheet, View } from "react-native";
import { spacing } from "@wolbachia/tokens";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { IconName } from "../../ui/icon-paths.ts";
import { causeKey, levelKey, nextKey } from "./copy.ts";
import type { BlockingLevel, GlobalState } from "./global-state.ts";

const MAX_SHOWN = 2;
const TONES = { blocking: "critical", warning: "warning", info: "info" } as const;
const ICONS: Readonly<Record<BlockingLevel, IconName>> = {
  blocking: "ban",
  warning: "alert",
  info: "clock",
};
const styles = StyleSheet.create({ list: { gap: spacing[1], padding: spacing[1] } });

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
    <View style={styles.list}>
      {states.slice(0, MAX_SHOWN).map((state) => (
        <Notice
          key={state.cause}
          tone={isCalm ? "info" : TONES[state.level]}
          icon={isCalm ? "clock" : ICONS[state.level]}
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
