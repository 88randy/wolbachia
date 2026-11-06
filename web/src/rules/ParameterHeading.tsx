import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import page from "../styles/page.module.css";
import styles from "./rules.module.css";
export function ParameterHeading({ name, parameterKey }: { name: string; parameterKey: string }) {
  const { t } = useTranslation();
  return (
    <>
      <Link to="/settings/rule-parameters" className={styles.back}>
        <ArrowLeft className={styles.badgeIcon} strokeWidth={1.5} aria-hidden="true" />
        {t("rules.detail.back")}
      </Link>
      <div className={styles.heading}>
        <h1 className={page.title}>{name}</h1>
        <span className={styles.code}>
          {t("rules.detail.key")}: <code>{parameterKey}</code>
        </span>
      </div>
    </>
  );
}
