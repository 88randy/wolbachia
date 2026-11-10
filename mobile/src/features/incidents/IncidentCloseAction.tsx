import { LogOut } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
  readonly closeShift: (() => void) | undefined;
}
export function IncidentCloseAction({ model, kind, closeShift }: Props) {
  const t = useT();
  const state = model.state;
  if (kind !== "accident" || state?.draft?.kind !== kind || !state.event || !closeShift)
    return null;
  return (
    <SecondaryButton icon={LogOut} label={t("mobile.incidents.safeClose")} onPress={closeShift} />
  );
}
