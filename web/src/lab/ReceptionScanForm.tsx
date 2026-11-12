import { useTranslation } from "react-i18next";
import { ScanLine } from "lucide-react";
import { Button } from "../ui/Button";
import { ScanField } from "../scan/ScanField";
import type { ReceptionActions } from "./use-reception-command";
import type { useReceptionScanner } from "./use-reception-scanner";
import styles from "./reception.module.css";

interface ReceptionScanFormProps {
  actions: ReceptionActions;
  scanner: ReturnType<typeof useReceptionScanner>;
}
export function ReceptionScanForm({ actions, scanner }: ReceptionScanFormProps) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        scanner.submit(scanner.code);
      }}
      className={styles.scanForm}
    >
      <ScanLine aria-hidden="true" className={styles.scanIcon} />
      <ScanField
        inputRef={scanner.input}
        id="bag-scan"
        expects="bag"
        label={t("labReception.scan.label")}
        aria-describedby="bag-scan-hint"
        value={scanner.code}
        onChange={scanner.setCode}
        onScan={scanner.submit}
      />
      <Button type="submit" aria-disabled={actions.isReviewRequired || !actions.canSubmit}>
        {t("labReception.scan.submit")}
      </Button>
      <p id="bag-scan-hint" className={styles.scanHint}>
        {t("labReception.scan.hint")}
      </p>
    </form>
  );
}
