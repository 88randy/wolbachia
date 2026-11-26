import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../ui/Button";
import { InlineNotice } from "../../../ui/InlineNotice";
import { errorKeyOf } from "./centers-api";
import { MoveResults } from "./MoveResults";
import { useBulkMove } from "./use-bulk-move";
import type { BulkMoveKind } from "./use-bulk-move";

interface BulkMoveStepProps {
  centerId: string;
  kind: BulkMoveKind;
  /** The picked destination id ("" while none). */
  destination: string;
  picker: ReactNode;
  actionLabel: string;
  /** One sentence shown on the confirm step. */
  summary: string;
}

function ConfirmBar({
  summary,
  onConfirm,
  onCancel,
}: {
  summary: string;
  onConfirm: () => void;
  onCancel: (isConfirming: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <InlineNotice tone="warning">
      <span className="flex flex-wrap items-center gap-2">
        {summary}
        <Button size="sm" onClick={onConfirm}>
          {t("centersAdmin.close.confirm")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onCancel(false);
          }}
        >
          {t("common.actions.cancel")}
        </Button>
      </span>
    </InlineNotice>
  );
}

function Outcome({ move, onRetry }: { move: ReturnType<typeof useBulkMove>; onRetry: () => void }) {
  const { t } = useTranslation();
  const hasFailures = move.data?.some((row) => row.status === "failed") ?? false;
  return (
    <>
      {move.isError && <InlineNotice tone="critical">{t(errorKeyOf(move.error))}</InlineNotice>}
      <MoveResults results={move.data ?? []} />
      {hasFailures && (
        <Button size="sm" variant="tertiary" loading={move.isPending} onClick={onRetry}>
          {t("centersAdmin.close.retry")}
        </Button>
      )}
    </>
  );
}

interface AskProps {
  label: string;
  disabled: boolean;
  loading: boolean;
  onAsk: (isConfirming: boolean) => void;
}

function AskButton({ label, disabled, loading, onAsk }: AskProps) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className="self-end"
      disabled={disabled}
      loading={loading}
      onClick={() => {
        onAsk(true);
      }}
    >
      {label}
    </Button>
  );
}

/** Pick a destination, confirm once, run the bulk move and show what failed, with a retry. */
export function BulkMoveStep(props: BulkMoveStepProps) {
  const [isConfirming, setConfirming] = useState(false);
  const move = useBulkMove(props.centerId, props.kind);
  const run = () => {
    setConfirming(false);
    move.mutate(props.destination);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        {props.picker}
        {!isConfirming && (
          <AskButton
            label={props.actionLabel}
            disabled={!props.destination}
            loading={move.isPending}
            onAsk={setConfirming}
          />
        )}
      </div>
      {isConfirming && (
        <ConfirmBar summary={props.summary} onConfirm={run} onCancel={setConfirming} />
      )}
      <Outcome move={move} onRetry={run} />
    </div>
  );
}
