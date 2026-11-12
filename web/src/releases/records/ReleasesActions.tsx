import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import { buttonVariants } from "../../ui/button-variants";
import { PERMIT_MANAGE } from "../permits/permissions";

/** Links from the releases list to the devices and, for who manages them, the permits. */
export function ReleasesActions() {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <>
      <Link to="/releases/devices" className={buttonVariants({ variant: "tertiary" })}>
        {t("releases.records.devicesLink")}
      </Link>
      {can(PERMIT_MANAGE) && (
        <Link to="/releases/permits" className={buttonVariants({ variant: "tertiary" })}>
          {t("releases.records.permitsLink")}
        </Link>
      )}
    </>
  );
}
