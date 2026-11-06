import type { M06Model } from "./use-m-06.ts";
import { DayProgress } from "./DayProgress.tsx";
import { TaskSection } from "./TaskSection.tsx";
export function DayList({ model }: { readonly model: M06Model }) {
  return (
    <>
      <DayProgress model={model} />
      <TaskSection title="mobile.day.pending" model={model} rows={model.pendingTasks} />
      <TaskSection title="mobile.day.closedSection" model={model} rows={model.closedTasks} />
      <TaskSection title="mobile.day.reviewedSection" model={model} rows={model.reviewedTasks} />
    </>
  );
}
