import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import page from "../styles/page.module.css";
import { useBreadcrumbLabel } from "../shell/breadcrumb-labels";
import styles from "./rules.module.css";
export function ParameterHeading({ name, parameterKey }: { name: string; parameterKey: string }) {
  const { t } = useTranslation();
  useBreadcrumbLabel(`/settings/rule-parameters/${parameterKey}`, name);
  return (
    <>
      <Link to="/settings/rule-parameters" className={styles.back}>
        <ArrowLeft className={styles.badgeIcon} strokeWidth={1.5} aria-hidden="true" />
        {t("rules.detail.back")}
      </Link>
      <div className={styles.heading}>
        <h1 className={page.title}>{name}</h1>
      </div>
    </>
  );
}
