import { Refreshing } from "../ui/Refreshing";
import { ParameterRefreshFailed } from "./ParameterRefreshFailed";
import styles from "./rules.module.css";
interface ParameterRefreshStateProps {
  error: Error | null;
  isFetching: boolean;
  onRetry: () => void;
}
/** Reserve the update indicator's space while keeping the record and draft mounted. */
export function ParameterRefreshState({ error, isFetching, onRetry }: ParameterRefreshStateProps) {
  return (
    <div className={styles.feedbackSlot}>
      {error !== null ? <ParameterRefreshFailed onRetry={onRetry} /> : isFetching && <Refreshing />}
    </div>
  );
}
