import { useT } from "../../i18n/I18nProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Button } from "../../ui/Button.tsx";
import { DayErrorDetails } from "./DayErrorDetails.tsx";
import type { DayFailure } from "./day-view-controller.ts";

interface Props {
  readonly failure: DayFailure | null;
  readonly retry: () => Promise<void>;
  readonly isBusy: boolean;
}
export function DayError({ failure, retry, isBusy }: Props) {
  const t = useT();
  if (failure === null) return null;
  return (
    <Card>
      <Notice tone="warning" icon="alert" message={t(failure.key)} />
      <Button
        label={t("common.actions.retry")}
        variant="outline"
        disabled={isBusy}
        onPress={() => {
          void retry();
        }}
      />
      <DayErrorDetails code={failure.code} />
    </Card>
  );
}
