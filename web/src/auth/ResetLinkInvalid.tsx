import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import { useFocusAlert } from "../forms/use-focus-alert";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";

/**
 * The emailed link is expired, already used or not valid (the API answers all three the same).
 * Says so and offers a new one. Takes focus because it replaces the form the user was typing in.
 */
export function ResetLinkInvalid() {
  const { t } = useTranslation();
  const alertRef = useFocusAlert(true);
  return (
    <>
      <FormAlert
        id="reset-link-alert"
        ref={alertRef}
        title={t("auth.reset.invalidLinkTitle")}
        text={t("auth.reset.invalidLinkBody")}
      />
      <Link to="/forgot-password" className={classNames(buttons.button, buttons.primary)}>
        {t("auth.reset.requestNew")}
      </Link>
    </>
  );
}
