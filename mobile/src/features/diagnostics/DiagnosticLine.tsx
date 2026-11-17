import type { MessageKey } from "@wolbachia/i18n";
import { useState } from "react";
import { Pressable } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { diagnostics } from "./diagnostic-log.ts";

const SAVE_ERRORS: readonly MessageKey[] = [
  "mobile.storage.saveFailed",
  "mobile.storage.unexpected",
  "mobile.storage.shiftClosed",
  "mobile.storage.actionFailed",
];

/** Debug builds (Metro, or the CI debug APK that sets the LAN flag) show the line always; release after a long press. */
const IS_DEBUG_BUILD =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_ALLOW_LAN_HTTP === "1");

/**
 * The technical line under a save error banner. The line is recorded before the error key is
 * set, so reading the last entry at render time is enough.
 */
export function DiagnosticLine({ errorKey }: { readonly errorKey: MessageKey | null }) {
  const t = useT();
  const [isRevealed, setRevealed] = useState(false);
  const last = diagnostics.last();
  if (errorKey === null || !SAVE_ERRORS.includes(errorKey) || last === null) return null;
  if (IS_DEBUG_BUILD || isRevealed)
    return (
      <AppText variant="caption" tone="secondary" selectable>
        {last.line}
      </AppText>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("courier.diagnostics.reveal")}
      onLongPress={() => {
        setRevealed(true);
      }}
      className="min-h-11 justify-center"
    >
      <AppText variant="caption" tone="secondary">
        {t("courier.diagnostics.reveal")}
      </AppText>
    </Pressable>
  );
}
