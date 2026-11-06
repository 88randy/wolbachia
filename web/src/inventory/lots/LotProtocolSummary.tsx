import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useCan } from "../../session/use-can";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { ErrorState } from "../../ui/ErrorState";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { currentSupplyOptions } from "../inventory-query";
import { useInventoryContext } from "../use-inventory-context";
import type { InventoryFieldsProps } from "../inventory-form-types";
import { ProtocolFacts } from "../ProtocolFacts";
import { lotProtocolOf, protocolValuesOf } from "../inventory-protocol";
interface AdoptionProps {
  fields: InventoryFieldsProps;
  current?: Schemas["Supply"];
}
interface ReviewedSupply {
  version: string;
  protocolId: string | null;
  label: string;
  revision: number;
  protocolName: string | null;
}
function useAdoption({ fields, current }: AdoptionProps) {
  const [reviewed, setReviewed] = useState<ReviewedSupply>();
  const open = () => {
    if (current)
      setReviewed({
        version: current.version,
        protocolId: current.protocol?.id ?? null,
        label: current.label,
        revision: current.revision,
        protocolName: current.protocol?.name ?? null,
      });
  };
  const confirm = () => {
    if (!reviewed) return;
    fields.setValue("adopt_supply_version_id", reviewed.version);
    fields.setValue("adopt_protocol_id", reviewed.protocolId ?? "");
    fields.setValue("adopt_supply_label", reviewed.label);
    fields.setValue("adopt_supply_revision", String(reviewed.revision));
    fields.setValue("adopt_protocol_name", reviewed.protocolName ?? "");
  };
  return {
    reviewed,
    open,
    confirm,
    readable: Boolean(current && (!current.protocol || protocolValuesOf(current.protocol))),
  };
}
function useReviewDescription(reviewed?: ReviewedSupply) {
  const { t } = useTranslation();
  if (!reviewed) return t("inventory.state.adopt");
  return [
    t("inventory.state.adopt"),
    reviewed.label,
    t("inventory.field.version") + ": " + String(reviewed.revision),
    t("inventory.section.protocol") +
      ": " +
      (reviewed.protocolName || t("inventory.state.unconfigured")),
  ].join(" · ");
}
function Adoption(props: AdoptionProps) {
  const { t } = useTranslation();
  const review = useAdoption(props);
  const consequence = useReviewDescription(review.reviewed);
  const trigger = (
    <Button
      variant="secondary"
      disabled={props.fields.disabled || !review.readable}
      onClick={review.open}
    >
      {t("inventory.action.adopt")}
    </Button>
  );
  return (
    <ConfirmDialog
      trigger={trigger}
      title={t("inventory.action.adopt")}
      consequence={consequence}
      actionLabel={t("inventory.action.adopt")}
      onConfirm={review.confirm}
    />
  );
}
function SelectedAdoption({ values }: Pick<InventoryFieldsProps, "values">) {
  const { t } = useTranslation();
  if (!values["adopt_supply_version_id"]) return null;
  return (
    <p role="status">
      {t("inventory.section.selected")}: {values["adopt_supply_label"]} ·{" "}
      {t("inventory.field.version")}: {values["adopt_supply_revision"]} ·{" "}
      {t("inventory.section.protocol")}:{" "}
      {values["adopt_protocol_name"] || t("inventory.state.unconfigured")}
    </p>
  );
}
function RetainedProtocol({ lot }: { lot: Schemas["Lot"] }) {
  const { t } = useTranslation();
  const protocol = lotProtocolOf(lot);
  return (
    <>
      <p>
        {lot.supply_version.label}: {protocol?.name || t("inventory.state.unconfigured")}
      </p>
      <p>
        {t("inventory.field.version")}: {lot.supply_version.revision}
      </p>
    </>
  );
}
function CurrentProtocol({ query }: { query: ReturnType<typeof useCurrentProtocol>["query"] }) {
  const { t } = useTranslation();
  return (
    <>
      {query.data && (
        <>
          <p>
            {t("inventory.section.current")}: {query.data.label}
          </p>
          <ProtocolFacts protocol={query.data.protocol} />
        </>
      )}
      {query.isError && (
        <ErrorState
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
    </>
  );
}
function useCurrentProtocol(previous: InventoryFieldsProps["previous"]) {
  const lot = previous && "supply_version" in previous ? previous : undefined;
  const allowed = useCan()("supply_type.read");
  const query = useQuery(
    currentSupplyOptions(useInventoryContext(), lot?.supply ?? "", allowed && Boolean(lot)),
  );
  return { lot, allowed, query };
}
export function LotProtocolSummary(fields: InventoryFieldsProps) {
  const { t } = useTranslation();
  const { lot, allowed, query } = useCurrentProtocol(fields.previous);
  if (!lot) return null;
  return (
    <Card title={t("inventory.section.protocol")}>
      <RetainedProtocol lot={lot} />
      <CurrentProtocol query={query} />
      {allowed && (
        <Adoption
          fields={{ ...fields, disabled: fields.disabled || query.isFetching }}
          current={query.data}
        />
      )}
      <SelectedAdoption values={fields.values} />
    </Card>
  );
}
