import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";
interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
  readonly closeShift: (() => void) | undefined;
}
export function IncidentCloseAction({ model, kind, closeShift }: Props) {
  const t = useT(),
    state = model.state;
  if (kind !== "accident" || state?.draft?.kind !== kind || !state.event || !closeShift)
    return null;
  return <Button variant="outline" label={t("mobile.incidents.safeClose")} onPress={closeShift} />;
}
