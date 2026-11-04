import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import styles from "./auth.module.css";

/** Way back to sign-in from the public pages. */
export function BackToLoginLink() {
  const { t } = useTranslation();
  return (
    <Link to="/login" className={styles.linkButton}>
      {t("auth.forgot.backToLogin")}
    </Link>
  );
}
