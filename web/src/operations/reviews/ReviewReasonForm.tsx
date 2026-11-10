import { ReviewActions } from "./ReviewActions";
import { ReviewReasonField } from "./ReviewReasonField";
import type { ReviewRecordState } from "./use-review-record";
import styles from "./reviews.module.css";

export function ReviewReasonForm({ state }: { state: ReviewRecordState }) {
  const frame = JSON.stringify([
    state.review?.id ?? state.id,
    state.review?.decision_state.revision,
    state.reason,
  ]);
  return (
    <div className={styles.actions}>
      <ReviewReasonField state={state} />
      <ReviewActions
        record={state.review?.event_id ?? state.id}
        frame={frame}
        canAccept={state.review?.evaluation.can_accept === true}
        canOpenIncident={state.scope.identity.permissions?.includes("incident.create") === true}
        isBlocked={state.isBlocked}
        send={(action, extra = "") =>
          state.command.send(action, extra ? `${state.reason}\n${extra}` : state.reason)
        }
      />
    </div>
  );
}
