import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { CloseDraft, PendingPoint } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";

interface Props {
  readonly model: M14Model;
  readonly point: PendingPoint;
  readonly dispositions: CloseDraft["dispositions"];
}
function usePointActions({ model, point, dispositions }: Props) {
  const { push } = useNavigation();
  const goNow = () => {
    void model.run(() => {
      push({ name: "day" });
      return Promise.resolve();
    });
  };
  const leavePending = () => {
    model.edit({ dispositions: { ...dispositions, [point.taskId]: "leave_pending" } });
  };
  return { goNow, leavePending };
}
export function PendingPointCard(props: Props) {
  const { model, point, dispositions } = props;
  const t = useT();
  const { goNow, leavePending } = usePointActions(props);
  const label =
    dispositions[point.taskId] === "leave_pending"
      ? "mobile.shiftClose.leftPending"
      : "mobile.shiftClose.leavePending";
  return (
    <Card>
      <AppText variant="bodyStrong">{point.pointCode}</AppText>
      <Button
        label={t("mobile.shiftClose.goNow")}
        variant="outline"
        disabled={model.isBusy}
        onPress={goNow}
      />
      <Button label={t(label)} variant="text" disabled={model.isBusy} onPress={leavePending} />
    </Card>
  );
}
