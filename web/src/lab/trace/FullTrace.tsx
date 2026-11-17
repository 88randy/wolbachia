import { TraceFacts } from "./TraceFacts";
import { TraceMap } from "./TraceMap";
import { TracePhotos } from "./TracePhotos";
import { TraceTimeline } from "./TraceTimeline";
import type { BagTrace } from "./trace-query";

/** Everything about the paddle's origin, stacked so it fits a side drawer. */
export function FullTrace({ trace }: { trace: BagTrace }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <TraceTimeline trace={trace} />
      <TraceMap trace={trace} />
      <TraceFacts trace={trace} />
      <TracePhotos photos={trace.reading.photos} />
    </div>
  );
}
