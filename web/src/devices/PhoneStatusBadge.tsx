import { CircleCheck, CircleSlash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import styles from "./phones.module.css";

/** Active or revoked: an icon and a word next to the color, never the color alone. */
export function PhoneStatusBadge({ isRevoked }: { isRevoked: boolean }) {
  const { t } = useTranslation();
  const Icon = isRevoked ? CircleSlash : CircleCheck;
  return (
    <span className={classNames(styles.badge, isRevoked ? styles.revoked : styles.active)}>
      <Icon className={styles.badgeIcon} aria-hidden="true" />
      {t(isRevoked ? "phones.status.revoked" : "phones.status.active")}
    </span>
  );
}
