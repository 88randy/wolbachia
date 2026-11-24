import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { LazyGeographyMap } from "../../quadrants/geography/LazyGeographyMap";
import { Card } from "../../ui/Card";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { trackLines } from "./track-model";
import { useShiftTrack } from "./track-queries";
import { TrackSegmentsTable } from "./TrackSegmentsTable";

const NO_AREAS = [] as const;

/** W29: the shift's track on the map plus its equivalent table. Rendered only with `courier_track.read`. */
export function ShiftTrackCard({ shiftId }: { shiftId: string }) {
  const { query } = useShiftTrack(shiftId);
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!query.data) return <CardSkeleton />;
  return <ShiftTrack track={query.data} />;
}

function ShiftTrack({ track }: { track: Schemas["ShiftTrack"] }) {
  const { t } = useTranslation();
  const { segments, pending_review_count: inReview } = track;
  return (
    <Card title={t("shift.track.title")}>
      <div className="flex flex-col gap-3">
        {inReview > 0 && (
          <InlineNotice tone="warning">
            {t("shift.track.inReview", { count: inReview })}
          </InlineNotice>
        )}
        {segments.length === 0 ? (
          <EmptyState kind="noData" message={t("shift.track.empty")} />
        ) : (
          <>
            <LazyGeographyMap quadrants={NO_AREAS} track={trackLines(segments)} />
            <TrackSegmentsTable segments={segments} />
          </>
        )}
      </div>
    </Card>
  );
}
