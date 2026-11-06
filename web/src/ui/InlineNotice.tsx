import type { ReactNode } from "react";
import { classNames } from "../styles/class-names";
import { ToneIcon } from "./ToneIcon";
import type { Tone } from "./tone";
import styles from "./ui.module.css";
export function InlineNotice({
  tone = "info",
  children,
  action,
}: {
  tone?: Tone;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={classNames(styles.notice, styles[tone])}>
      <ToneIcon tone={tone} />
      <div>{children}</div>
      {action}
    </div>
  );
}
