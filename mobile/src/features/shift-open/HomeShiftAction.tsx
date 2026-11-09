import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";
export function HomeShiftAction({ model }: { readonly model: M04Model }) {
  const t = useT();
  const { push } = useNavigation();
  const isRejected = model.state?.opening?.status === "rejected";
  const start = () => {
    void model
      .run(() => (isRejected ? model.service.restartRejected() : model.service.start()))
      .then((ok) => {
        if (ok) push({ name: "openShift" });
      });
  };
  if (model.state?.opening && !isRejected) return <ShiftAction label={t(model.state.locallyClosedAt ? "mobile.shiftClose.closedTitle" : "mobile.shiftClose.title")} onPress={() => { push({ name: "closeShift" }); }} />;
  return (
    <ShiftAction
      label={t(
        isRejected
          ? "mobile.shiftOpen.correctAndRetry"
          : model.state?.draft
            ? "mobile.shiftOpen.resume"
            : "mobile.shiftOpen.start",
      )}
      disabled={model.isBusy || model.state === null}
      onPress={start}
    />
  );
}
