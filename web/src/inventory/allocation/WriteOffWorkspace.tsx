import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { ListPage } from "../../components/templates/ListPage";
import { WriteOffSheet } from "./WriteOffSheet";
import { WriteOffTable } from "./WriteOffTable";
import type { AllocationScope } from "./allocation-query";
import type { WriteOffKind } from "./use-write-off-form";

/** W17 and W39 differ only by route, title and default target; behavior is one shared form. */
export function WriteOffWorkspace(props: {
  scope: AllocationScope;
  route: string;
  kind: WriteOffKind;
  titleKey: MessageKey;
}) {
  const { t } = useTranslation();
  const { scope, route, kind, titleKey } = props;
  return (
    <ListPage
      title={t(titleKey)}
      description={t("allocation.writeOff.description")}
      actions={<WriteOffSheet scope={scope} route={route} kind={kind} />}
    >
      <WriteOffTable scope={scope} route={route} />
    </ListPage>
  );
}
