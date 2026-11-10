import { useT } from "../../i18n/I18nProvider.tsx";
import { BottomActions } from "../../ui/BottomActions.tsx";
import { Button } from "../../ui/Button.tsx";
import { ReleaseSaveActions } from "./ReleaseSaveActions.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseFooter({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (model.isLoading) return null;
  return (
    <BottomActions>
      {model.status === "draft" ? (
        <ReleaseSaveActions model={model} />
      ) : (
        <Button label={t("mobile.release.backToDay")} onPress={model.goBackToDay} />
      )}
    </BottomActions>
  );
}
