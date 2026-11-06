import { CircleCheck, TriangleAlert, CircleAlert, Info, CircleMinus } from "lucide-react";
import type { Tone } from "./tone";
import styles from "./ui.module.css";
const ICONS = {
  success: CircleCheck,
  warning: TriangleAlert,
  critical: CircleAlert,
  info: Info,
  neutral: CircleMinus,
};
export function ToneIcon({ tone }: { tone: Tone }) {
  const Icon = ICONS[tone];
  return <Icon aria-hidden="true" strokeWidth={1.5} className={styles.icon} />;
}
