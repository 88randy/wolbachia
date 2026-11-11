import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { fixActionFor } from "./fix-action.ts";
import type { GlobalCause } from "./global-state.ts";
import { useSafety } from "./SafetyProvider.tsx";

/** "Activar ubicación", "Dar permiso"...: takes the user straight to the fix of a warning. */
export function FixButton({ cause }: { readonly cause: GlobalCause }) {
  const t = useT();
  const { recheckLocation } = useSafety();
  const action = fixActionFor(cause);
  if (action === null) return null;
  return (
    <SecondaryButton
      icon={action.icon}
      label={t(action.labelKey)}
      onPress={() => {
        void action.run(recheckLocation);
      }}
    />
  );
}
