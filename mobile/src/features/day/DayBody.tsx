import { DaySkeleton } from "./DaySkeleton.tsx";
import { DayList } from "./DayList.tsx";
import { PointDetail } from "./PointDetail.tsx";
import type { M06Model } from "./use-m-06.ts";

export function DayBody({ model }: { readonly model: M06Model }) {
  if (model.state === null) return model.isLoading ? <DaySkeleton /> : null;
  return model.selected === null ? <DayList model={model} /> : <PointDetail model={model} />;
}
