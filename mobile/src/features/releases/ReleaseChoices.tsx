import { ReleaseChoiceList } from "./ReleaseChoiceList.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseChoices({ model }: { readonly model: ReleaseViewModel }) {
  if (model.hasDraft) return null;
  const disabled = model.isBusy || model.status !== "draft";
  return (
    <>
      <ReleaseChoiceList
        kind="task"
        options={model.taskOptions}
        selectedId={model.selectedTaskId}
        disabled={disabled}
        onSelect={model.selectTask}
      />
      <ReleaseChoiceList
        kind="device"
        options={model.deviceOptions}
        selectedId={model.selectedDeviceId}
        disabled={disabled}
        onSelect={model.selectDevice}
      />
    </>
  );
}
