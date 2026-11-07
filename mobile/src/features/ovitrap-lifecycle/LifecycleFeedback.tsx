import { View } from "react-native";
import { DeliveryOutcome } from "./DeliveryOutcome.tsx";
import { ProposalFeedback } from "./ProposalFeedback.tsx";
import { LifecycleCorrection } from "./LifecycleCorrection.tsx";
import { LifecycleEntry } from "./LifecycleEntry.tsx";
import type { LifecycleProps } from "./model.ts";
export function LifecycleFeedback(props: LifecycleProps) {
  const { model, draft } = props;
  const state = model.state;
  if (!state?.event) return null;
  return (
    <View>
      <DeliveryOutcome event={state.event} reviews={state.reviews} />
      {state.proposal ? (
        <ProposalFeedback
          proposal={state.proposal}
          openTask={
            !model.isBusy && !state.isScopeBlocked
              ? () => {
                  model.openTask(draft.eventId);
                }
              : undefined
          }
        />
      ) : null}
      <LifecycleCorrection key={draft.eventId} {...props} />
      {draft.kind === "replace" && draft.replacementId ? (
        <LifecycleEntry ovitrapId={draft.replacementId} manualCapture={draft.manualCapture} />
      ) : null}
    </View>
  );
}
