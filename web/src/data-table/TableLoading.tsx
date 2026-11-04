import styles from "./data-table.module.css";

const SKELETON_ROWS = 5;

/** First load: shapes of rows, hidden from screen readers (the live region says "loading"). */
export function TableLoading() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }, (_unused, index) => (
        <div key={index} className={styles.skeletonRow} />
      ))}
    </div>
  );
}
