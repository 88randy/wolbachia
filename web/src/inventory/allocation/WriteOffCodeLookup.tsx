import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { WriteOffForm } from "./use-write-off-form";
import styles from "../inventory.module.css";

function LookupResult({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const { target } = form;
  const name =
    target?.kind === "lot"
      ? `${target.lot.code} · ${target.lot.supply_version.label}`
      : target?.bag.code;
  return (
    <div aria-live="polite">
      {form.lookup.state === "notFound" && (
        <InlineNotice tone="warning">{t("allocation.writeOff.notFound")}</InlineNotice>
      )}
      {form.lookup.state === "failed" && (
        <InlineNotice tone="critical">{t("allocation.writeOff.lookupFailed")}</InlineNotice>
      )}
      {name && <p>{name}</p>}
    </div>
  );
}

/** Resolve a human code in the scoped collection; unknown and foreign codes look the same. */
export function WriteOffCodeLookup({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const id = useId();
  const find = () => void form.lookup.find(form.kind, form.code);
  return (
    <div>
      <div className={styles.actions}>
        <TextField
          id={id}
          label={t("allocation.writeOff.fieldCode")}
          value={form.code}
          onChange={(event) => {
            form.setCode(event.target.value);
            form.lookup.clear();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            find();
          }}
        />
        <Button variant="secondary" loading={form.lookup.state === "loading"} onClick={find}>
          {t("allocation.writeOff.find")}
        </Button>
      </div>
      <LookupResult form={form} />
    </div>
  );
}
