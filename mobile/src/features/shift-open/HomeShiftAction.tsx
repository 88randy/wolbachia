import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";

function openingActionKey(model: M04Model, isRejected: boolean): MessageKey {
  if (isRejected) return "mobile.shiftOpen.correctAndRetry";
  return model.state?.draft ? "mobile.shiftOpen.resume" : "mobile.shiftOpen.start";
}

function startOpening(model: M04Model, isRejected: boolean, open: () => void): void {
  void model
    .run(() => (isRejected ? model.service.restartRejected() : model.service.start()))
    .then((ok) => {
      if (ok) open();
    });
}

export function HomeShiftAction({ model }: { readonly model: M04Model }) {
  const t = useT();
  const { push } = useNavigation();
  const isRejected = model.state?.opening?.status === "rejected";
  if (model.state?.opening && !isRejected)
    return (
      <ShiftAction
        label={t(
          model.state.locallyClosedAt ? "mobile.shiftClose.closedTitle" : "mobile.shiftClose.title",
        )}
        onPress={() => {
          push({ name: "closeShift" });
        }}
      />
    );
  return (
    <ShiftAction
      label={t(openingActionKey(model, isRejected))}
      disabled={model.isBusy || model.state === null}
      onPress={() => {
        startOpening(model, isRejected, () => {
          push({ name: "openShift" });
        });
      }}
    />
  );
}
