import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { buttonVariants } from "../ui/button-variants";
import { InlineNotice } from "../ui/InlineNotice";

/** After applying: what was done, and the next step of the weekly cycle. */
export function RiskImportDone({ count, week }: { count: number; week: string }) {
  const { t } = useTranslation();
  return (
    <PageFrame width="narrow">
      <PageHeader title={t("scheduling.import.title")} />
      <InlineNotice tone="success">
        <p className="font-semibold">{t("scheduling.import.applied", { count })}</p>
      </InlineNotice>
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="m-0 text-base font-semibold">{t("scheduling.import.nextStep")}</h2>
        <p className="m-0 text-sm text-ink-2">{t("scheduling.import.nextText")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/scheduling/assignments"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            <Users aria-hidden="true" />
            {t("scheduling.import.goAssign")}
          </Link>
          <Link
            to="/scheduling/risk"
            search={{ week }}
            className={buttonVariants({ variant: "tertiary", size: "lg" })}
          >
            {t("scheduling.import.seeResult")}
          </Link>
        </div>
      </section>
    </PageFrame>
  );
}
