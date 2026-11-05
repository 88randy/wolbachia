import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";
export function HomeShiftAction({ model }: { readonly model: M04Model }) {
  const t = useT();
  const { push } = useNavigation();
  const start = () => {
    void model
      .run(() => model.service.start())
      .then((ok) => {
        if (ok) push({ name: "openShift" });
      });
  };
  if (model.state?.opening) return null;
  return (
    <ShiftAction
      label={t(model.state?.draft ? "mobile.shiftOpen.resume" : "mobile.shiftOpen.start")}
      disabled={model.isBusy || model.state === null}
      onPress={start}
    />
  );
}
