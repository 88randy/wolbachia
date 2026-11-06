import { Refreshing } from "../ui/Refreshing";
import { FleetLoadError } from "./FleetLoadError";
import styles from "./fleet.module.css";
interface FleetRecordFeedbackProps {
  error: unknown;
  isRefreshing: boolean;
  onRetry: () => void;
}
/** A regular refresh does not move the record's action buttons or replace its data. */
export function FleetRecordFeedback({ error, isRefreshing, onRetry }: FleetRecordFeedbackProps) {
  return (
    <div className={styles.feedbackSlot}>
      {isRefreshing && <Refreshing />}
      {error !== null && <FleetLoadError error={error} onRetry={onRetry} />}
    </div>
  );
}
