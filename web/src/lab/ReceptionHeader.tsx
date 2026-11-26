import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/templates/PageHeader";
import { buttonVariants } from "../ui/button-variants";
import { InfoHint } from "../ui/InfoHint";

export function ReceptionHeader({ canCount }: { canCount: boolean }) {
  const { t } = useTranslation();
  return (
    <PageHeader
      title={t("labReception.page.title")}
      description={
        <>
          {t("labReception.page.subtitle")} <InfoHint text={t("labReception.page.scope")} />
        </>
      }
      actions={
        canCount && (
          <Link to="/lab/egg-counts" className={buttonVariants({ variant: "primary" })}>
            <FlaskConical aria-hidden="true" className="size-4" />
            {t("labReception.action.countQueue")}
          </Link>
        )
      }
    />
  );
}
