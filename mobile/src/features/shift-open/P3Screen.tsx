import { captureShiftId } from "../ovitrap-check/shift-authorization.ts";
import { HomeNextCard } from "./HomeNextCard.tsx";
import { HomeShiftDetails } from "./HomeShiftDetails.tsx";
import { HomeTiles } from "./HomeTiles.tsx";
import { SaveFeedback } from "./SaveFeedback.tsx";
import { useHomeNext } from "./use-home-next.ts";
import { useM04 } from "./use-m-04.ts";

/** Mi día body: "Lo que sigue", the local shift status and the action grid. No invented data. */
export function P3Screen() {
  const model = useM04();
  const next = useHomeNext(model);
  const hasShift = Boolean(model.state?.opening && model.state.opening.status !== "rejected");
  return (
    <>
      <SaveFeedback model={model} />
      <HomeNextCard model={next} isBusy={model.isBusy || model.state === null} />
      {model.state?.opening ? <HomeShiftDetails state={model.state} /> : null}
      <HomeTiles canCapture={Boolean(captureShiftId(model.state))} hasShift={hasShift} />
    </>
  );
}
