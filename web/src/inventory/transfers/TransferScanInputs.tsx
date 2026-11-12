import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { ScanField } from "../../scan/ScanField";
import type { TransferScannerProps } from "./TransferScanner";
export function TransferScanInputs({ model, isBlocked }: TransferScannerProps) {
  const { t } = useTranslation();
  return (
    <>
      <ScanField
        id="transfer-scan"
        expects="lot"
        inputRef={model.scanner}
        label={t("transfers.scan.label")}
        value={model.scan}
        onChange={model.setScan}
        onScan={(code) => {
          if (!isBlocked) model.add(code);
        }}
        hint={t("transfers.scan.hint")}
        readOnly={isBlocked}
      />
      <TextField
        id="transfer-quantity"
        label={t("transfers.scan.quantity")}
        inputMode="decimal"
        value={model.quantity}
        onChange={model.changeQuantity}
        readOnly={isBlocked}
      />
    </>
  );
}
