import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { useOnlineStatus } from "../../shell/use-online-status";
import { RelocationStateNotice } from "./RelocationStateNotice";
import type { Relocation } from "./relocations-query";
import type { RelocationDecisionProps } from "./RelocationDecision";
import type { useRelocationCommand } from "./use-relocation-command";
import { RelocationReason } from "./RelocationReason";
import styles from "./relocations.module.css";
interface FormProps extends RelocationDecisionProps {
  proposal: Relocation;
  command: ReturnType<typeof useRelocationCommand>;
  isVerified: boolean;
}
function decisionControls(
  { scope, proposal, reason, command, isVerified }: FormProps,
  isOnline: boolean,
) {
  const isBlocked = proposal.status !== "pending" || !!proposal.voided_at;
  const isDisabled =
    isBlocked ||
    !isOnline ||
    !isVerified ||
    !scope.identity.isSettled ||
    command.isBusy ||
    !!command.failure ||
    !reason.trim();
  return {
    isBlocked,
    isDisabled,
    reject: () => {
      if (!isDisabled) void command.execute({ id: proposal.id, decision: "reject", reason });
    },
    approve: () => {
      if (!isDisabled) void command.execute({ id: proposal.id, decision: "approve", reason });
    },
  };
}
export function RelocationDecisionForm(props: FormProps) {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const controls = decisionControls(props, isOnline);
  if (!props.scope.canDecide) return null;
  return (
    <section className={styles.content} aria-label={t("relocations.workspace.decision")}>
      <RelocationStateNotice isBlocked={controls.isBlocked} isOnline={isOnline} />
      <RelocationReason reason={props.reason} onChange={props.onReasonChange} />
      <div className={styles.actions}>
        <Button variant="secondary" aria-disabled={controls.isDisabled} onClick={controls.reject}>
          {t("relocations.workspace.reject")}
        </Button>
        <Button
          aria-disabled={controls.isDisabled}
          loading={props.command.isBusy}
          onClick={controls.approve}
        >
          {t("relocations.workspace.approve")}
        </Button>
      </div>
    </section>
  );
}
