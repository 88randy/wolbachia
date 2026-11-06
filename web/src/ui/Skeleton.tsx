import { classNames } from "../styles/class-names";
import { useSkeletonVisible } from "./use-skeleton-visible";
import styles from "./ui.module.css";
export function Skeleton({ shape = "line" }: { shape?: "line" | "value" | "chart" | "circle" }) {
  const isVisible = useSkeletonVisible();
  return (
    <span
      aria-hidden="true"
      className={classNames(styles.skeleton, styles[shape], isVisible && styles.skeletonVisible)}
    />
  );
}
