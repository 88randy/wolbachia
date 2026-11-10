import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Card } from "../../ui/Card";
import { WriteOffSheet } from "./WriteOffSheet";
import { WriteOffTable } from "./WriteOffTable";
import type { AllocationScope } from "./allocation-query";
import type { WriteOffKind } from "./use-write-off-form";
import styles from "../inventory.module.css";

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
    <div className={styles.content}>
      <Card
        title={t(titleKey)}
        headingLevel={1}
        actions={<WriteOffSheet scope={scope} route={route} kind={kind} />}
      >
        <WriteOffTable scope={scope} route={route} />
      </Card>
    </div>
  );
}
