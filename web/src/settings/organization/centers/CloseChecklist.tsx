import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { DetailPage } from "../../../components/templates/DetailPage";
import { Button } from "../../../ui/Button";
import { ErrorState } from "../../../ui/ErrorState";
import type { CenterRow } from "./centers-api";
import { CloseRow } from "./CloseRow";
import { CloseRowAction } from "./CloseRowAction";
import { DeactivateStep } from "./DeactivateStep";
import { useCloseFlow } from "./use-close-flow";
import type { CloseFlow } from "./use-close-flow";

const PERCENT = 100;

/** "2 de 4 listos" with a progress bar, announced when it changes. */
function CloseProgress({ flow }: { flow: CloseFlow }) {
  const { t } = useTranslation();
  const label = t("centersAdmin.close.progress", {
    done: flow.readyCount,
    total: flow.blockingTotal,
  });
  const value = flow.blockingTotal ? (flow.readyCount / flow.blockingTotal) * PERCENT : 0;
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <span className="text-sm font-semibold">{label}</span>
      <Progress value={value} aria-label={label} />
    </div>
  );
}

function RecheckButton({ flow }: { flow: CloseFlow }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" loading={flow.isChecking} onClick={flow.recheck}>
      {t("centersAdmin.close.recheck")}
    </Button>
  );
}

/** "Cerrar centro": a live checklist of what blocks it, each row with one action, then the reason. */
export function CloseChecklist({ center }: { center: CenterRow }) {
  const { t } = useTranslation();
  const flow = useCloseFlow(center);
  return (
    <DetailPage
      title={t("centersAdmin.close.title", { name: center.name })}
      code={center.code}
      subtitle={t("centersAdmin.close.intro")}
      back={{
        label: center.name,
        link: { to: "/settings/organization/centers/$code", params: { code: center.code } },
      }}
      actions={<RecheckButton flow={flow} />}
    >
      <CloseProgress flow={flow} />
      {flow.isLoadError && <ErrorState onRetry={flow.recheck} />}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {flow.rows.map((row) => (
          <CloseRow key={row.key} row={row}>
            <CloseRowAction row={row} flow={flow} />
          </CloseRow>
        ))}
      </ul>
      <DeactivateStep flow={flow} />
    </DetailPage>
  );
}
