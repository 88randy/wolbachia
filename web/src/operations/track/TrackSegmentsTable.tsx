import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useFormatNumber } from "../../format/use-formatters";

const HEAD = "font-mono text-xs font-semibold tracking-wide text-ink-2 uppercase";

/** The equivalent of the track map: one row per segment, in phone time. */
export function TrackSegmentsTable({
  segments,
}: {
  segments: readonly Schemas["TrackSegmentRead"][];
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-line">
      <Table aria-label={t("shift.track.table")}>
        <SegmentHead />

        <TableBody>
          {segments.map((segment) => (
            <SegmentRow key={segment.id} segment={segment} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SegmentHead() {
  const { t } = useTranslation();
  return (
    <TableHeader className="bg-surface-muted">
      <TableRow>
        <TableHead scope="col" className={HEAD}>
          {t("shift.track.segmentStart")}
        </TableHead>
        <TableHead scope="col" className={HEAD}>
          {t("shift.track.segmentEnd")}
        </TableHead>
        <TableHead scope="col" className={`${HEAD} text-right`}>
          {t("shift.track.positions")}
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function SegmentRow({ segment }: { segment: Schemas["TrackSegmentRead"] }) {
  const format = useFormatDateTime();
  const number = useFormatNumber();
  return (
    <TableRow>
      <TableCell className="text-[13px] tabular-nums">
        <time dateTime={segment.started_at}>{format(segment.started_at)}</time>
      </TableCell>
      <TableCell className="text-[13px] tabular-nums">
        <time dateTime={segment.ended_at}>{format(segment.ended_at)}</time>
      </TableCell>
      <TableCell className="text-right text-[13px] tabular-nums">
        {number(segment.positions.length)}
      </TableCell>
    </TableRow>
  );
}
