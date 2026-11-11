import { useEffect } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import type { QrKind } from "../ovitrap-check/types.ts";
import { ScannerControls } from "./ScannerControls.tsx";
import { ScannerPreview } from "./ScannerPreview.tsx";
import { useM07 } from "./use-m-07.ts";

function questionKind(expected: QrKind | undefined, bindsLabel: boolean) {
  if (bindsLabel) return "label";
  if (expected === "bag" || expected === "ovitrap") return expected;
  return "any";
}

/** The scanner: the camera opens by itself, the code is read by itself, and it opens what it finds. */
export function P11Screen({
  expected,
  eventId,
  bindsLabel = false,
}: {
  readonly expected?: QrKind;
  readonly eventId?: string | null;
  readonly bindsLabel?: boolean;
}) {
  const t = useT();
  const model = useM07(expected, eventId, bindsLabel);
  const { start, isLoading } = model;
  useEffect(() => {
    if (!isLoading) void start();
    // Opens the camera once when the screen is ready; the buttons below only recover from problems.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);
  const kind = questionKind(expected, bindsLabel);
  return (
    <ScreenScaffold header={<AppHeader title={t("field.scan.title")} />}>
      <StepQuestion title={t(`field.scan.question.${kind}`)} hint={t("field.scan.hint")} />
      {model.isLoading ? <Skeleton /> : null}
      <ScannerPreview model={model} />
      <ScannerControls model={model} />
    </ScreenScaffold>
  );
}
