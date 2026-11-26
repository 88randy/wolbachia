import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../../components/templates/DetailPage";
import { useCouriers } from "../../scheduling/use-directories";
import { Card } from "../../ui/Card";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { LiveMapCard } from "./LiveMapCard";
import { LiveShiftItem } from "./LiveShiftItem";
import { useLiveShifts } from "./use-live-shifts";
import { useLiveTracking } from "./use-live-tracking";

/** W28: who is out working right now. A shift that closes disappears from this list and the map. */
export function W28Page() {
  const { t } = useTranslation();
  const search: Record<string, string | undefined> = useSearch({ strict: false });
  const live = useLiveShifts(search["courier"]);
  return (
    <DetailPage
      title={t("live.title")}
      subtitle={t("live.description", { count: live.shifts.length })}
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
        <LiveBoard live={live} courier={search["courier"]} />
      )}
    </DetailPage>
  );
}

interface BoardProps {
  live: ReturnType<typeof useLiveShifts>;
  courier: string | undefined;
}

function LiveBoard({ live, courier }: BoardProps) {
  const { t } = useTranslation();
  const { nameOf } = useCouriers(live.shifts.map((shift) => shift.courier));
  const tracking = useLiveTracking(live.shifts, courier);
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card title={t("live.listTitle")}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {live.shifts.map((shift) => (
            <LiveShiftItem
              key={shift.id}
              shift={shift}
              name={nameOf(shift.courier)}
              places={live.quadrantsOf(shift.courier).map((row) => row.code)}
              isChosen={courier === shift.courier}
              position={tracking.canTrack ? tracking.positionOf(shift.id) : null}
            />
          ))}
        </ul>
      </Card>
      <LiveMapCard
        quadrants={live.mapQuadrants}
        couriers={tracking.mapCouriers(nameOf)}
        track={tracking.track}
        errors={tracking.errors}
      />
    </div>
  );
}
