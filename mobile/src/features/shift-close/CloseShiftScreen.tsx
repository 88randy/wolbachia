import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { P26Screen } from "./P26Screen.tsx";
import { P27Screen } from "./P27Screen.tsx";
import { useM14 } from "./use-m-14.ts";

/** Close the shift: small steps, then a summary of the day. */
export function CloseShiftScreen() {
  const model = useM14();
  const t = useT();
  const draft = model.state?.draft;
  if (model.state && draft?.locallyClosedAt) return <P27Screen state={model.state} />;
  if (model.state && draft) return <P26Screen model={model} draft={draft} />;
  return (
    <ScreenScaffold header={<AppHeader title={t("field.close.title")} />}>
      {model.state === null ? (
        <Skeleton />
      ) : (
        <InfoNotice tone="info" message={t("field.close.noShift")} />
      )}
    </ScreenScaffold>
  );
}
