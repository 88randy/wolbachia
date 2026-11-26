import { LockKeyhole, RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { M09Model } from "./use-m-09.ts";

/** The action cannot start right now: one sentence about why, and one way to try again. */
export function LifecycleBlocked({
  model,
  retry,
}: {
  readonly model: M09Model;
  readonly retry: () => void;
}) {
  const t = useT();
  const state = model.state;
  const isClosed = state?.frameState === "closed";
  const message = state?.isShiftBlocked
    ? "field.lifecycle.needShift"
    : state?.recovery
      ? "field.lifecycle.recoveryBlocked"
      : isClosed
        ? "field.lifecycle.weekClosed"
        : state?.isScopeBlocked
          ? "field.lifecycle.notYours"
          : "field.lifecycle.cannotStart";
  return (
    <>
      <EmptyState
        icon={LockKeyhole}
        title={t(message)}
        message={t("field.lifecycle.blockedHint")}
        actionLabel={t("field.action.retry")}
        actionIcon={RotateCw}
        onAction={retry}
      />
      {state?.catalogChanged ? (
        <InfoNotice tone="warning" message={t("field.lifecycle.listChanged")} />
      ) : null}
    </>
  );
}
