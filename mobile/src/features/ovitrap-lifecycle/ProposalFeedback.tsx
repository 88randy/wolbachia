import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PROPOSAL_LABEL } from "./labels.ts";
import type { RelocationProposal } from "./types.ts";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
type Translate = ReturnType<typeof useT>;
function decisionLines(proposal: RelocationProposal, t: Translate) {
  return proposal.decision
    ? [
        proposal.decision.reason ?? t("mobile.lifecycle.decisionReasonUnknown"),
        proposal.decision.decidedAt ?? t("mobile.lifecycle.decisionTimeUnknown"),
      ]
    : [t("mobile.lifecycle.decisionPending")];
}
function taskLines(proposal: RelocationProposal, t: Translate) {
  const task = proposal.nextDayTask;
  return task
    ? [
        t("mobile.lifecycle.nextTask"),
        task.code,
        task.dueDate,
        t(
          proposal.isTaskActionable
            ? "mobile.lifecycle.taskAssigned"
            : "mobile.lifecycle.taskReferenceOnly",
        ),
      ]
    : [t("mobile.lifecycle.noTask")];
}
function auditLines(proposal: RelocationProposal, t: Translate) {
  return [
    ...(proposal.sourceVoidedAt
      ? [t("mobile.lifecycle.sourceVoided", { at: proposal.sourceVoidedAt })]
      : []),
    ...(proposal.legacyDecision ? [t("mobile.lifecycle.legacyDecision")] : []),
  ];
}
export function ProposalFeedback({
  proposal,
  openTask,
}: {
  readonly proposal: RelocationProposal;
  readonly openTask?: () => void;
}) {
  const t = useT();
  const lines = [
    t(PROPOSAL_LABEL[proposal.status]),
    ...decisionLines(proposal, t),
    ...taskLines(proposal, t),
    ...auditLines(proposal, t),
  ];
  return (
    <View>
      {lines.map((text, index) => (
        <AppText key={index}>{text}</AppText>
      ))}
      {openTask && proposal.isTaskActionable ? (
        <ShiftAction label={t("mobile.lifecycle.openTask")} onPress={openTask} />
      ) : null}
    </View>
  );
}
