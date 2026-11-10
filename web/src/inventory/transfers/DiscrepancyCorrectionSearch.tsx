import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import type { DiscrepancyCorrectionModel } from "./discrepancy-use-correction";

export function DiscrepancyCorrectionSearch({ model }: { model: DiscrepancyCorrectionModel }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      <TextField
        id={id}
        label={t("discrepancies.correction.code")}
        value={model.code}
        onChange={(event) => {
          model.changeCode(event.currentTarget.value);
        }}
      />
      <Button
        variant="secondary"
        loading={model.query.isFetching}
        onClick={() => {
          model.setLookup(model.code.trim());
        }}
      >
        {t("discrepancies.correction.find")}
      </Button>
      {model.isUnavailable && <p role="status">{t("discrepancies.correction.unavailable")}</p>}
    </>
  );
}
