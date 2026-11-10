import { useT } from "../../i18n/I18nProvider.tsx";
import { Counter } from "../../ui/Counter.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

interface Props {
  readonly model: ReleaseViewModel;
  readonly disabled: boolean;
}

function toCount(text: string): number {
  const value = Math.round(Number(text.replace(",", ".")));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Sachets to release: a big counter instead of a typed number. */
export function ReleaseQuantity({ model, disabled }: Props) {
  const t = useT();
  return (
    <>
      <Counter
        label={t("courier.flow.release.sachets")}
        value={toCount(model.quantity)}
        onChange={(value) => {
          if (disabled) return;
          model.changeQuantity(String(value));
          model.blurQuantity();
        }}
      />
      {model.quantityErrorKey ? (
        <InfoNotice tone="danger" message={t(model.quantityErrorKey)} />
      ) : null}
    </>
  );
}
