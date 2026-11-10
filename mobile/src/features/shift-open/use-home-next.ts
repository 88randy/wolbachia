import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { homeNext } from "./home-next.ts";
import type { HomeNext } from "./home-next.ts";
import type { M04Model } from "./use-m-04.ts";

export interface HomeNextModel {
  readonly next: HomeNext;
  /** Opens the next step; null when there is nothing to do. */
  readonly go: (() => void) | null;
}

/** The single next action of the home screen, reusing the existing P3 start/resume/retry rules. */
export function useHomeNext(model: M04Model): HomeNextModel {
  const { push } = useNavigation();
  const next = homeNext(model.state);
  const startOpening = (isRejected: boolean) => {
    void model
      .run(() => (isRejected ? model.service.restartRejected() : model.service.start()))
      .then((ok) => {
        if (ok) push({ name: "openShift" });
      });
  };
  const actions: Readonly<Record<HomeNext, (() => void) | null>> = {
    openShift: () => {
      startOpening(false);
    },
    resume: () => {
      startOpening(false);
    },
    retry: () => {
      startOpening(true);
    },
    route: () => {
      push({ name: "day" });
    },
    loading: null,
    closed: null,
  };
  return { next, go: actions[next] };
}
