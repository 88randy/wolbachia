import { RouteProblem } from "./RouteProblem.tsx";
import type { M06Model } from "./use-m-06.ts";

/** Each failed step of the day in plain words, with one button to try it again. */
export function RouteProblems({ model }: { readonly model: M06Model }) {
  return (
    <>
      <RouteProblem failure={model.errors.read} retry={model.read} isBusy={model.isLoading} />
      <RouteProblem failure={model.errors.refresh} retry={model.refresh} isBusy={model.isRefreshing} />
      <RouteProblem failure={model.errors.action} retry={model.retryAction} isBusy={model.isActing} />
    </>
  );
}
