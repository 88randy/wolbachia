import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { FormSection } from "../../components/templates/FormSection";
import { useLanguage } from "../../i18n/use-language";
import { ScanField } from "../../scan/ScanField";
import { InlineNotice } from "../../ui/InlineNotice";
import type { InventoryFieldsProps } from "../inventory-form-types";
import { useLotScanFill } from "./use-lot-scan-fill";
import type { FillResult } from "./use-lot-scan-fill";
import type { FilledField } from "./lot-scan-fill";
import { useState } from "react";

const FIELD_KEYS: Record<FilledField | "supply", MessageKey> = {
  code: "scan.lot.field.code",
  expiry_date: "scan.lot.field.expiry",
  quantity: "scan.lot.field.quantity",
  supply: "scan.lot.field.supply",
};

function Outcome({ result }: { result: FillResult }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (result.kind === "loading")
    return <p className="m-0 text-sm text-ink-2">{t("scan.lot.loading")}</p>;
  if (result.kind === "unknown")
    return <InlineNotice tone="warning">{t("scan.lot.unknown")}</InlineNotice>;
  if (result.kind === "failed")
    return <InlineNotice tone="critical">{t("scan.lot.failed")}</InlineNotice>;
  if (result.kind !== "filled") return null;
  const names = [
    ...result.fields,
    ...(result.supplyLabel === null ? [] : (["supply"] as const)),
  ].map((field) => t(FIELD_KEYS[field]));
  return (
    <div className="flex flex-col gap-2">
      {names.length > 0 && (
        <InlineNotice tone="success">
          {t("scan.lot.filled", {
            fields: new Intl.ListFormat(language, { type: "conjunction" }).format(names),
          })}
        </InlineNotice>
      )}
      {result.hasGtin && result.supplyLabel === null && (
        <InlineNotice tone="warning">{t("scan.lot.noSupply")}</InlineNotice>
      )}
      {names.length === 0 && !result.hasGtin && (
        <InlineNotice tone="warning">{t("scan.lot.nothing")}</InlineNotice>
      )}
    </div>
  );
}

/**
 * Receiving supplies: scan the supplier's label (GS1) and the form fills itself, or scan one of
 * our own lot labels to open that lot. Shown only while creating a lot.
 */
export function LotScanFill(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const fill = useLotScanFill(props);
  return (
    <FormSection title={t("scan.lot.title")} description={t("scan.lot.hint")}>
      <div className="flex min-w-0 flex-col gap-3" aria-live="polite">
        <div className="max-w-md">
          <ScanField
            id="lot-scan-fill"
            expects="lot"
            acceptsSupplier
            label={t("scan.lot.label")}
            value={code}
            disabled={props.disabled}
            onChange={setCode}
            onScan={(scanned) => {
              setCode("");
              void fill.scan(scanned);
            }}
          />
        </div>
        <Outcome result={fill.result} />
      </div>
    </FormSection>
  );
}
