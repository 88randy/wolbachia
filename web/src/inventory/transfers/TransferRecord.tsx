import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { DetailPage } from "../../components/templates/DetailPage";
import { useCan } from "../../session/use-can";
import { TransferStatus } from "./TransferStatus";
import { TransferHistory } from "./TransferHistory";
import { TransferDispatch } from "./TransferDispatch";
import { TransferReception } from "./TransferReception";
import type { Transfer, TransferScope } from "./transfer-query";
import type { TransferMemory } from "./use-transfer-write";
export interface TransferRecordProps {
  scope: TransferScope;
  transfer: Transfer;
  memory: TransferMemory;
}
function TransferBack() {
  const { t } = useTranslation();
  return (
    <Link
      to="/inventory/transfers"
      className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-action"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t("inventory.action.back")}
    </Link>
  );
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
export function TransferRecord(props: TransferRecordProps) {
  const can = useCan();
  const { transfer, memory } = props;
  const { t } = useTranslation();
  const action =
    memory.command?.action ??
    (transfer.state === "prepared"
      ? "dispatch"
      : transfer.state === "dispatched"
        ? "receive"
        : null);
  return (
    <DetailPage
      title={transfer.code}
      status={<TransferStatus state={transfer.state} />}
      actions={<TransferBack />}
    >
      <TransferAction {...props} action={can(`transfer.${action ?? "none"}`) ? action : null} />
      <Card title={t("transfers.history.title")}>
        <TransferHistory transfer={transfer} />
      </Card>
    </DetailPage>
  );
}
