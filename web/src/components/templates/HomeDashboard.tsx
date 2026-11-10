import { CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import { StateFrame } from "../../ui/StateFrame";
import { HubGrid } from "./HubGrid";
import type { HubCardItem } from "./HubCard";
import { PageFrame } from "./PageFrame";
import { PageHeader } from "./PageHeader";

export interface HomeDashboardProps {
  title: string;
  description?: ReactNode;
  /**
   * "Lo que tienes pendiente": one card per pending action, with its count, that opens the
   * action directly (the filtered list or the screen that resolves it). Only items with work.
   * Omit it until the profile has a real pending source: never show an invented "all done".
   */
  pending?: readonly HubCardItem[];
  /** A band right under the header for the one thing that cannot wait (a critical item). */
  alert?: ReactNode;
  /** Shown while the pending counts load for the first time. */
  isLoading?: boolean;
  /** KPIs, charts (each with its data table) or shortcuts below the pending cards. */
  children?: ReactNode;
}

/** Template 4 of 4, Home dashboard: greeting, pending-action cards, then the profile's widgets. */
export function HomeDashboard(props: HomeDashboardProps) {
  const { title, description, pending, alert, isLoading = false, children } = props;
  const { t } = useTranslation();
  useDocumentTitle(title);
  return (
    <PageFrame>
      <PageHeader title={title} description={description} />
      {alert}
      {pending && (
        <section aria-labelledby="home-pending" className="flex flex-col gap-3">
          <h2 id="home-pending" className="m-0 text-base font-semibold">
            {t("common.pending.title")}
          </h2>
          {pending.length > 0 ? (
            <HubGrid items={pending} label={t("common.pending.title")} />
          ) : (
            !isLoading && (
              <div className="rounded-2xl border border-line bg-surface shadow-card">
                <StateFrame icon={CircleCheck} message={t("common.pending.empty")} />
              </div>
            )
          )}
        </section>
      )}
      {children}
    </PageFrame>
  );
}
