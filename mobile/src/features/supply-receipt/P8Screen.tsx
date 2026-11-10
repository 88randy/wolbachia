import { useEffect } from "react";
import { ReceiptCountStep } from "./ReceiptCountStep.tsx";
import { ReceiptProblemStep } from "./ReceiptProblemStep.tsx";
import { ReceiptSaved } from "./ReceiptSaved.tsx";
import { ReceiptSignStep } from "./ReceiptSignStep.tsx";
import { ReleasePicker } from "./ReleasePicker.tsx";
import { useM05 } from "./use-m-05.ts";
import { useReceiptStep } from "./use-receipt-step.ts";

/** Supplies receipt wizard: pick the delivery, count it, say if all is fine, sign. */
export function P8Screen() {
  const model = useM05();
  const { step, next, back } = useReceiptStep(model.state?.draft?.eventId);
  const { recover, service } = model;
  useEffect(() => {
    void recover(() => service.refresh());
    // Downloads the deliveries of the day once when the screen opens; there is no button for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const draft = model.state?.draft ?? null;
  const event = model.state?.event ?? null;
  if (draft === null) return <ReleasePicker model={model} />;
  if (event !== null) return <ReceiptSaved event={event} />;
  if (step === 1) return <ReceiptCountStep model={model} draft={draft} onNext={next} />;
  if (step === 2)
    return <ReceiptProblemStep model={model} draft={draft} onNext={next} onBack={back} />;
  return <ReceiptSignStep model={model} draft={draft} onBack={back} />;
}
