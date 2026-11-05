import { CardSkeleton } from "../ui/CardSkeleton";
import { KpiSkeleton } from "../ui/KpiSkeleton";
import styles from "./PendingState.module.css";
export function PendingState() {
  return (
    <div className={styles.pending}>
      <KpiSkeleton />
      <CardSkeleton />
    </div>
  );
}
