import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import formStyles from "../forms/form.module.css";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";

/**
 * The emailed link is expired, already used or not valid (the API answers all three the same).
 * Says so and offers a new one. Takes focus because it replaces the form the user was typing in.
 */
export function ResetLinkInvalid() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <>
      <div ref={ref} role="alert" tabIndex={-1} className={formStyles.alert}>
        <p className={formStyles.alertTitle}>{t("auth.reset.invalidLinkTitle")}</p>
        <p className={formStyles.alertText}>{t("auth.reset.invalidLinkBody")}</p>
      </div>
      <Link to="/forgot-password" className={classNames(buttons.button, buttons.primary)}>
        {t("auth.reset.requestNew")}
      </Link>
    </>
  );
}
