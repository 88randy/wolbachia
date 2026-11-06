import { useT } from "../../i18n/I18nProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { useM06 } from "./use-m-06.ts";
import { DayToggle } from "./DayToggle.tsx";
import { DayContent } from "./DayContent.tsx";
export function P9Screen() {
  const model = useM06();
  const t = useT();
  return (
    <>
      <ScreenHeader title={model.selected?.task.point_code ?? t("mobile.day.title")} />
      <DayToggle isMap={false} />
      <DayContent model={model} />
    </>
  );
}
