import { useId } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useFleetDialog } from "./use-fleet-dialog";
import { FleetServiceFields } from "./FleetServiceFields";
import { FleetOperationForm } from "./FleetOperationForm";
import type { FleetOperationProps } from "./FleetOperationForm";
import dialogStyles from "../void/void-dialog.module.css";
import styles from "./fleet.module.css";
export function ServiceRecordDialog({ draft, operations }: FleetOperationProps) {
  const { t } = useTranslation();
  const title = useId();
  const busy = draft.phase !== "idle";
  const modal = useFleetDialog(busy, operations.close);
  return (
    <dialog {...modal} className={cn(dialogStyles.dialog, styles.wide)} aria-labelledby={title}>
      <h2 id={title}>{t("fleet.action.service")}</h2>
      <p>{t("fleet.service.hint")}</p>
      <FleetOperationForm draft={draft} operations={operations}>
        <FleetServiceFields
          draft={draft}
          disabled={busy || operations.isUnverified || draft.failure === "uncertain"}
          change={operations.change}
          blur={operations.blur}
        />
      </FleetOperationForm>
    </dialog>
  );
}
