import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { HistoryGroup } from "./domain.ts";

export function HistoryGroupCard({
  group,
  select,
}: {
  readonly group: HistoryGroup;
  readonly select: (id: string) => void;
}) {
  const t = useT();
  return (
    <Card>
      <AppText isMonospace>{group.date ?? t("mobile.history.unknownTime")}</AppText>
      {group.shiftId ? (
        <>
          <AppText variant="caption">{t("mobile.history.shift")}</AppText>
          <AppText isMonospace>{group.shiftId}</AppText>
        </>
      ) : null}
      <Button
        variant="outline"
        label={t("mobile.history.openShift")}
        onPress={() => {
          select(group.id);
        }}
      />
    </Card>
  );
}
