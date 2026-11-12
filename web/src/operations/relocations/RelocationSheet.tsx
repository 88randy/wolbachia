import { useCallback, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SideSheet } from "../../ui/SideSheet";
import { Button } from "../../ui/Button";
import type { RelocationScope } from "./relocations-query";
import { RelocationDecision } from "./RelocationDecision";
export function RelocationSheet({ scope }: { scope: RelocationScope }) {
  const { t } = useTranslation();
  const sheet = useRelocationSheet();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SideSheet
        title={t("relocations.workspace.decision")}
        description={t("relocations.workspace.samePoint")}
        open={!!sheet.code}
        onOpenChange={sheet.onOpenChange}
        trigger={<ReviewTrigger isBlocked={!sheet.code} />}
      >
        {sheet.code && (
          <RelocationDecision
            key={`${scope.context}:${sheet.code}`}
            scope={scope}
            code={sheet.code}
            reason={sheet.reason}
            onReasonChange={sheet.onReasonChange}
          />
        )}
      </SideSheet>
      {!sheet.code && <PickFirstHint />}
    </div>
  );
}

function ReviewTrigger({ isBlocked }: { isBlocked: boolean }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="secondary"
      aria-disabled={isBlocked}
      aria-describedby={isBlocked ? "relocation-pick-first" : undefined}
    >
      {t("relocations.workspace.openSelected")}
    </Button>
  );
}

/** Why the review button is blocked: nothing is selected yet. */
function PickFirstHint() {
  const { t } = useTranslation();
  return (
    <p id="relocation-pick-first" className="m-0 text-[13px] text-ink-2">
      {t("relocations.workspace.pickFirst")}
    </p>
  );
}

function useRelocationSheet() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const code =
    "relocation" in search && typeof search.relocation === "string" ? search.relocation : "";
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const onReasonChange = useCallback(
    (reason: string) => {
      setReasons((previous) => ({ ...previous, [code]: reason }));
    },
    [code],
  );
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen)
      void navigate({ to: ".", search: (previous) => ({ ...previous, relocation: undefined }) });
  };
  return { code, reason: reasons[code] ?? "", onReasonChange, onOpenChange };
}
