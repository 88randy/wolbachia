import type { M06Model } from "./use-m-06.ts";
import { DayError } from "./DayError.tsx";

export function DayErrors({ model }: { readonly model: M06Model }) {
  return (
    <>
      <DayError failure={model.errors.read} retry={model.read} isBusy={model.isLoading} />
      <DayError failure={model.errors.refresh} retry={model.refresh} isBusy={model.isRefreshing} />
      <DayError failure={model.errors.map} retry={model.retryMap} isBusy={model.isMapLoading} />
      <DayError failure={model.errors.action} retry={model.retryAction} isBusy={model.isActing} />
    </>
  );
}
