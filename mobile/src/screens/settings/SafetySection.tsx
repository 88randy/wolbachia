import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { SettingsStateView } from "./SettingsStateView.tsx";
import { useSettingsState } from "./use-settings-state.ts";

export function SafetySection() {
  const state = useSettingsState();
  const { push } = useNavigation();
  return (
    <SettingsStateView
      state={state.state}
      hasError={state.hasError}
      onLock={state.lock}
      onInbox={() => {
        push({ name: "inbox" });
      }}
      onRetry={state.retry}
    />
  );
}
