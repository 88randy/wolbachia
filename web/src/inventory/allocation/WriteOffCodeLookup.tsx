import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ScanField } from "../../scan/ScanField";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { WriteOffTargetSummary } from "./WriteOffTargetSummary";
import type { WriteOffForm } from "./use-write-off-form";
import styles from "../inventory.module.css";

function LookupResult({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {form.lookup.state === "notFound" && (
        <InlineNotice tone="warning">
          <span>{t("allocation.writeOff.notFound")}</span>{" "}
          <Button variant="tertiary" size="sm" onClick={form.startOver}>
            {t("allocation.writeOff.anotherCode")}
          </Button>
        </InlineNotice>
      )}
      {form.lookup.state === "failed" && (
        <InlineNotice tone="critical">{t("allocation.writeOff.lookupFailed")}</InlineNotice>
      )}
      {form.target && <WriteOffTargetSummary form={form} />}
    </div>
  );
}

/**
 * Scan (reader or camera), type or pick the lot or bag: its record is found and the form fills
 * itself. Unknown and foreign codes look the same.
 */
export function WriteOffCodeLookup({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div>
      <div className={styles.actions}>
        <ScanField
          id={id}
          expects={form.kind}
          label={t("allocation.writeOff.fieldCode")}
          hint={t("allocation.writeOff.scanHint")}
          value={form.code}
          onChange={(code) => {
            form.setCode(code);
            form.lookup.clear();
          }}
          onScan={(code) => void form.chooseCode(code)}
        />
        <Button
          variant="secondary"
          loading={form.lookup.state === "loading"}
          onClick={() => void form.chooseCode(form.code)}
        >
          {t("allocation.writeOff.find")}
        </Button>
      </div>
      <LookupResult form={form} />
    </div>
  );
}
