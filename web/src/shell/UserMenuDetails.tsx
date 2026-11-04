import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { useMe } from "../session/use-me";
import styles from "./UserMenu.module.css";
import { displayNameOf, profileLabelOf } from "./user-display";

/** Name, profiles (labels in the UI language) and organization of the signed-in user. */
export function UserMenuDetails() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const me = useMe();
  const profiles = me.profiles.map((profile) => profileLabelOf(profile, language));
  return (
    <>
      <p className={styles.name}>{displayNameOf(me.user)}</p>
      <dl className={styles.details}>
        <dt>{t("shell.userMenu.profiles")}</dt>
        <dd>{profiles.length > 0 ? profiles.join(", ") : t("shell.userMenu.noProfile")}</dd>
        <dt>{t("shell.userMenu.organization")}</dt>
        <dd>{me.organization?.name}</dd>
      </dl>
    </>
  );
}
