import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "../../ui/button-variants";

/** Links from the releases list to the devices and the permits. */
export function ReleasesActions() {
  const { t } = useTranslation();
  return (
    <>
      <Link to="/releases/devices" className={buttonVariants({ variant: "tertiary" })}>
        {t("releases.records.devicesLink")}
      </Link>
      <Link to="/releases/permits" className={buttonVariants({ variant: "tertiary" })}>
        {t("releases.records.permitsLink")}
      </Link>
    </>
  );
}
