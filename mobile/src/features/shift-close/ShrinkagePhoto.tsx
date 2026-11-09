import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import type { ReconcileDraft } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";

interface Props {
  readonly model: M14Model;
  readonly supply: ReconcileDraft;
}
export function ShrinkagePhoto({ model, supply }: Props) {
  const t = useT();
  const capturePhoto = () => {
    model.capturePhoto(supply.eventId);
  };
  return (
    <>
      <Button label={t("mobile.shiftClose.photo")} disabled={model.isBusy} onPress={capturePhoto} />
      <AppText>
        {t(
          supply.photos?.length
            ? "mobile.shiftClose.photoSaved"
            : "mobile.shiftClose.photoRequired",
        )}
      </AppText>
    </>
  );
}
