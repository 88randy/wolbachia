import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { buttonVariants } from "../../ui/button-variants";
import { DetailPage } from "../../components/templates/DetailPage";
import { DetailSection } from "../../components/templates/DetailSection";
import { useCan } from "../../session/use-can";
import { useLanguage } from "../../i18n/use-language";
import { formatInventoryQuantity } from "../format-inventory-quantity";
import { useLocationNames } from "../use-location-names";
import { TransferStatus } from "./TransferStatus";
import { TransferHistory } from "./TransferHistory";
import { TransferDispatch } from "./TransferDispatch";
import { TransferReception } from "./TransferReception";
import { TransferSteps } from "./TransferSteps";
import type { Transfer, TransferScope } from "./transfer-query";
import type { TransferMemory } from "./use-transfer-write";
export interface TransferRecordProps {
  scope: TransferScope;
  transfer: Transfer;
  memory: TransferMemory;
}
function TransferAction(props: TransferRecordProps & { action: "dispatch" | "receive" | null }) {
  const { t } = useTranslation();
  if (props.action === "dispatch")
    return (
      <Card title={t("transfers.action.dispatch")}>
        <TransferDispatch {...props} />
      </Card>
    );
  if (props.action === "receive")
    return (
      <Card title={t("transfers.action.receive")}>
        <TransferReception {...props} />
      </Card>
    );
  return null;
}
function TransferItems({ transfer }: { transfer: Transfer }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <DetailSection title={t("transfers.record.items")}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-ink-2">
            <th className="py-2 pr-4">{t("transfers.record.lot")}</th>
            <th className="py-2 text-right">{t("transfers.record.quantity")}</th>
          </tr>
        </thead>
        <tbody>
          {transfer.lines.map((line) => (
            <tr key={line.id} className="border-t border-line">
              <td className="py-2 pr-4">{line.lot_code}</td>
              <td className="py-2 text-right tabular-nums">
                {formatInventoryQuantity(line.quantity, language)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DetailSection>
  );
}
export function TransferRecord(props: TransferRecordProps) {
  const can = useCan();
  const nameOf = useLocationNames();
  const { transfer, memory } = props;
  const { t } = useTranslation();
  const action =
    memory.command?.action ??
    (transfer.state === "prepared"
      ? "dispatch"
      : transfer.state === "dispatched"
        ? "receive"
        : null);
  const unknown = t("inventory.state.unconfigured");
  return (
    <DetailPage
      title={transfer.code}
      status={<TransferStatus state={transfer.state} />}
      subtitle={t("transfers.record.route", {
        origin: nameOf(transfer.origin_id) ?? unknown,
        destination: nameOf(transfer.destination_id) ?? unknown,
      })}
      back={{ label: t("inventory.action.back"), link: { to: "/inventory/transfers" } }}
      actions={
        transfer.state === "discrepancy" && can("discrepancy.read") ? (
          <Link to="/inventory/discrepancies" className={buttonVariants({ variant: "primary" })}>
            {t("transfers.record.seeDifference")}
          </Link>
        ) : undefined
      }
    >
      <TransferSteps state={transfer.state} />
      <TransferAction {...props} action={can(`transfer.${action ?? "none"}`) ? action : null} />
      <TransferItems transfer={transfer} />
      <Card title={t("transfers.history.title")}>
        <TransferHistory transfer={transfer} />
      </Card>
    </DetailPage>
  );
}
