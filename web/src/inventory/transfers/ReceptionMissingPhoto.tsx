import { useTranslation } from "react-i18next";
import { TransferEvidence } from "./TransferEvidence";
import type { ReceptionLineProps } from "./ReceptionLine";
export function ReceptionMissingPhoto({ line, model, scope }: ReceptionLineProps) {
  const { t } = useTranslation();
  const missing = model.missing.find((entry) => entry.line_id === line.id);
  if (!missing) return null;
  const verifyPhoto = (id: string) => {
    model.verifyPhoto(line.id, id);
  };
  return (
    <TransferEvidence
      scope={scope}
      label={t("transfers.line.photo", { id: line.piece_id ?? line.lot_id })}
      isBlocked={model.write.isBusy || model.write.isFrozen}
      onVerified={verifyPhoto}
    />
  );
}
