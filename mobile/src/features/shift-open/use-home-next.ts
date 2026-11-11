import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { MessageKey } from "@wolbachia/i18n";
import { homeLock, lockReasonKey } from "./home-lock.ts";
import { homeNext } from "./home-next.ts";
import type { HomeNext } from "./home-next.ts";
import type { M04Model } from "./use-m-04.ts";

export interface HomeNextModel {
  readonly next: HomeNext;
  /** Opens the next step; null when there is nothing to do. */
  readonly go: (() => void) | null;
  /** The real reason when the next step is a blocker; replaces the card body. */
  readonly reasonKey: MessageKey | null;
}

function blockedReason(next: HomeNext, model: M04Model): MessageKey | null {
  return next === "blocked" ? lockReasonKey(homeLock(model.state)) : null;
}

function useOpeningStarter(model: M04Model): (isRejected: boolean) => void {
  const { push } = useNavigation();
  return (isRejected) => {
    void model
      .run(() => (isRejected ? model.service.restartRejected() : model.service.start()))
      .then((ok) => {
        if (ok) push({ name: "openShift" });
      });
  };
}

/** The single next action of the home screen, reusing the existing P3 start/resume/retry rules. */
export function useHomeNext(model: M04Model): HomeNextModel {
  const { push } = useNavigation();
  const next = homeNext(model.state);
  const startOpening = useOpeningStarter(model);
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
    // Only a missing map can be fixed from home; any other blocker has no button.
    blocked:
      model.state?.gate === "map"
        ? () => {
            void model.run(() => model.service.prepareMap());
          }
        : null,
    route: () => {
      push({ name: "day" });
    },
    loading: null,
    closed: null,
  };
  return { next, go: actions[next], reasonKey: blockedReason(next, model) };
}
