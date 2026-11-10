import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { receivedUnits } from "./transfer-reception";
import { quantityText } from "./transfer-quantities";
import type { TransferScope } from "./transfer-query";
import type { useTransferReception } from "./use-transfer-reception";
import { nameOrDash } from "../../lookups/use-reference-names";
import styles from "../inventory.module.css";
import { ReceptionMissingPhoto } from "./ReceptionMissingPhoto";
export interface ReceptionLineProps {
  line: Schemas["TransferLine"];
  model: ReturnType<typeof useTransferReception>;
  scope: TransferScope;
}
export function ReceptionLine(props: ReceptionLineProps) {
  const { t } = useTranslation();
  const { line, model } = props;
  return (
    <li className={styles.form}>
      <p>{nameOrDash(line.lot_code)}</p>
      <p>
        {t("transfers.line.count", {
          expected: line.quantity,
          received: quantityText(receivedUnits(model.draft, line.id)),
        })}
      </p>
      <ReceptionMissingPhoto {...props} />
    </li>
  );
}
