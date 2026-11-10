import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { useTransferReception } from "./use-transfer-reception";
import styles from "../inventory.module.css";
import { TransferScanInputs } from "./TransferScanInputs";
export interface TransferScannerProps {
  model: ReturnType<typeof useTransferReception>;
  isBlocked: boolean;
}
export function TransferScanner({ model, isBlocked }: TransferScannerProps) {
  const { t } = useTranslation();
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isBlocked) model.add();
      }}
    >
      <TransferScanInputs model={model} isBlocked={isBlocked} />
      <Button type="submit" disabled={isBlocked}>
        {t("transfers.scan.add")}
      </Button>
      <p role="status" aria-live="polite">
        {t(`transfers.scan.${model.notice as "ready"}`)}
      </p>
    </form>
  );
}
