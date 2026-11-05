import { useId } from "react";
import { formatDateTime } from "../format/format-date-time";
import { useLanguage } from "../i18n/use-language";
import { formatRelativeTime } from "./relative-time";
import { useRelativeClock } from "./use-relative-clock";
import { AbsoluteTimeTooltip } from "./AbsoluteTimeTooltip";
import styles from "./analytics.module.css";
interface RelativeTimeProps {
  dateTime: string;
  timeZone: string;
  now?: number;
}
/** The caller supplies the organization's zone; the absolute moment remains available to AT. */
export function RelativeTime({ dateTime, timeZone, now }: RelativeTimeProps) {
  const { language } = useLanguage();
  const clock = useRelativeClock(now);
  const descriptionId = useId();
  const absolute = formatDateTime(dateTime, language, timeZone);
  const label = formatRelativeTime(dateTime, language, clock);
  return (
    <>
      <AbsoluteTimeTooltip absolute={absolute}>
        {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The timestamp must receive focus to reveal its absolute time without a pointer (WCAG 1.4.13). */}
        <time
          dateTime={dateTime}
          tabIndex={0}
          className={styles.relativeTime}
          aria-describedby={descriptionId}
        >
          {label}
        </time>
        {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
      </AbsoluteTimeTooltip>
      <span id={descriptionId} className={styles.srOnly}>
        {absolute}
      </span>
    </>
  );
}
