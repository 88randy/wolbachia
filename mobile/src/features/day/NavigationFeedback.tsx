import { useT } from "../../i18n/I18nProvider.tsx";
import type { NavigationOutcome } from "../../navigation/navigation-service.ts";
import type { MessageKey } from "@wolbachia/i18n";
import { Notice } from "../../ui/Notice.tsx";
const KEYS: Readonly<Record<NavigationOutcome, MessageKey>> = {
  launched: "mobile.day.launched",
  no_handler: "mobile.day.noHandler",
  denied: "mobile.day.denied",
  invalid_coordinates: "mobile.day.invalidCoordinates",
};
export function NavigationFeedback({ outcome }: { readonly outcome: NavigationOutcome | null }) {
  const t = useT();
  return outcome === null ? null : (
    <Notice
      tone={outcome === "launched" ? "info" : "warning"}
      icon="navigation"
      message={t(KEYS[outcome])}
    />
  );
}
