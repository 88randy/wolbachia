import type { MessageKey } from "@wolbachia/i18n";
import { Archive, Ban, CircleCheck, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RuleParameterVersion } from "./rules-query";
import styles from "./rules.module.css";

type Status = RuleParameterVersion["status"];

/** Typed on the API's status enum. Each state has its own icon and word, never the color alone. */
const STATUS: Record<Status, { icon: LucideIcon; label: MessageKey; className: string }> = {
  scheduled: { icon: Clock, label: "rules.status.scheduled", className: styles.scheduled ?? "" },
  in_force: { icon: CircleCheck, label: "rules.status.inForce", className: styles.inForce ?? "" },
  superseded: {
    icon: Archive,
    label: "rules.status.superseded",
    className: styles.superseded ?? "",
  },
  voided: { icon: Ban, label: "rules.status.voided", className: styles.voided ?? "" },
};

export function VersionStatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  const { icon: Icon, label, className } = STATUS[status];
  return (
    <span className={className}>
      <Icon className={styles.badgeIcon} aria-hidden="true" />
      {t(label)}
    </span>
  );
}
