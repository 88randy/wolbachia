import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { P4Screen } from "./P4Screen.tsx";
import { P5Screen } from "./P5Screen.tsx";
import { P6Screen } from "./P6Screen.tsx";
import { P7Screen } from "./P7Screen.tsx";
import { useM04 } from "./use-m-04.ts";
import type { M04Model } from "./use-m-04.ts";

function stepScreen(model: M04Model) {
  if (model.state?.opening) return <P7Screen model={model} />;
  switch (model.state?.draft?.step) {
    case "motorcycle":
      return <P4Screen model={model} />;
    case "checklist":
      return <P5Screen model={model} />;
    case "odometer":
      return <P6Screen model={model} />;
    case "maps":
      return <P7Screen model={model} />;
    default:
      return null;
  }
}

/** Opening wizard: moto, safety check, odometer, go. Each step is its own page. */
export function OpenShiftScreen() {
  const model = useM04();
  const t = useT();
  const screen = stepScreen(model);
  if (screen !== null) return screen;
  return (
    <ScreenScaffold header={<AppHeader title={t("field.open.title")} />}>
      <Skeleton />
    </ScreenScaffold>
  );
}
