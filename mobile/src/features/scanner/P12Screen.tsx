import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { InvalidCode } from "./InvalidCode.tsx";
import { SupplyActions } from "./SupplyActions.tsx";
import { SupplyDetails } from "./SupplyDetails.tsx";
import { useSupplyDetail } from "./use-supply-detail.ts";

/** What a scanned supply is. Shows the downloaded plan only; it never changes custody or counts. */
export function P12Screen({ lotId }: { readonly lotId: string }) {
  const t = useT();
  const result = useSupplyDetail(lotId);
  return (
    <ScreenScaffold
      header={<AppHeader title={t("field.scan.supplyTitle")} />}
      footer={<SupplyActions isAvailable={result !== null && "resource" in result} />}
    >
      {result === null ? (
        <Skeleton />
      ) : "error" in result ? (
        <InvalidCode reason={result.error} />
      ) : (
        <SupplyDetails resource={result.resource} />
      )}
    </ScreenScaffold>
  );
}
