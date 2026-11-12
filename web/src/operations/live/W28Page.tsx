import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Bike, Clock, Map as MapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../../components/templates/DetailPage";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { LazyGeographyMap } from "../../quadrants/geography/LazyGeographyMap";
import { useCouriers } from "../../scheduling/use-directories";
import { cn } from "@/lib/utils";
import { Card } from "../../ui/Card";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { StatusPill } from "../../ui/StatusPill";
import { useLiveShifts } from "./use-live-shifts";

/** W28: who is out working right now. A shift that closes disappears from this list and the map. */
export function W28Page() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormatDateTime();
  const search: Record<string, string | undefined> = useSearch({ strict: false });
  const courier = search["courier"];
  const live = useLiveShifts(courier);
  const { nameOf } = useCouriers(live.shifts.map((shift) => shift.courier));
  return (
    <DetailPage
      title={t("live.title")}
      description={t("live.description", { count: live.shifts.length })}
      notices={
        <InlineNotice tone="info">
          <p>{t("live.note")}</p>
        </InlineNotice>
      }
    >
      {live.isError ? (
        <ErrorState onRetry={live.refetch} />
      ) : live.isPending ? (
        <CardSkeleton />
      ) : live.shifts.length === 0 ? (
        <Card title={t("live.title")}>
          <EmptyState kind="noData" message={t("live.empty")} />
        </Card>
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card title={t("live.listTitle")}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {live.shifts.map((shift) => {
                const isChosen = courier === shift.courier;
                const places = live.quadrantsOf(shift.courier).map((row) => row.code);
                return (
                  <li key={shift.id}>
                    <div
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border border-line p-3",
                        isChosen && "border-action bg-tint",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-semibold text-ink">
                          <Bike aria-hidden="true" className="size-4 text-action" />
                          {nameOf(shift.courier)}
                        </span>
                        <StatusPill tone="success">{t("live.working")}</StatusPill>
                      </div>
                      <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
                        <Clock aria-hidden="true" className="size-3.5" />
                        {t("live.since", { time: format(shift.opened_at_device) })}
                        {" · "}
                        {shift.motorcycle_code}
                      </p>
                      {places.length > 0 && (
                        <p className="m-0 text-[13px] text-ink-2">
                          {t("live.quadrants", { list: places.join(", ") })}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-[13px] font-semibold">
                        <button
                          type="button"
                          className="min-h-8 cursor-pointer rounded-lg border-0 bg-transparent px-1 text-action-strong underline"
                          onClick={() => {
                            void navigate({
                              to: ".",
                              search: isChosen ? {} : { courier: shift.courier },
                            });
                          }}
                        >
                          {t(isChosen ? "live.showAll" : "live.focus")}
                        </button>
                        <Link
                          to="/operations/shifts/$code"
                          params={{ code: shift.code }}
                          className="inline-flex min-h-8 items-center text-action-strong"
                        >
                          {t("live.details")}
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <MapIcon aria-hidden="true" className="size-4" />
                {t("live.mapTitle")}
              </span>
            }
          >
            {live.mapQuadrants.length > 0 ? (
              <LazyGeographyMap quadrants={live.mapQuadrants} />
            ) : (
              <EmptyState kind="noData" message={t("live.noMap")} />
            )}
          </Card>
        </div>
      )}
    </DetailPage>
  );
}
