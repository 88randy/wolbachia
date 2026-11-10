import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M12Model } from "./use-m-12.ts";
export function IncidentUndoPhoto({ model }: { readonly model: M12Model }) {
  const t = useT(),
    state = model.state;
  if (!state?.draft?.evidence.length || state.event) return null;
  const id = state.draft.eventId;
  return (
    <Button
      variant="text"
      label={t("mobile.camera.undo")}
      disabled={model.isBusy || !state.ready}
      onPress={() => {
        void model.run(() => model.service.undoPhoto(id));
      }}
    />
  );
}
