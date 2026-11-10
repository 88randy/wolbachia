import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { ScanState } from "./use-assignment-draft";
import styles from "../inventory.module.css";

const SCAN_KEYS: Record<Exclude<ScanState, "idle" | "loading">, MessageKey> = {
  notFound: "allocation.assignment.scanResultNotFound",
  duplicate: "allocation.assignment.scanResultDuplicate",
  piece: "allocation.assignment.scanResultPiece",
  failed: "allocation.assignment.scanResultFailed",
};

function enterKey(submit: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submit();
  };
}

function ScanResult({ scan }: { scan: ScanState }) {
  const { t } = useTranslation();
  return (
    <div aria-live="polite">
      {scan !== "idle" && scan !== "loading" && (
        <InlineNotice tone="warning">{t(SCAN_KEYS[scan])}</InlineNotice>
      )}
    </div>
  );
}

/** Scanner-first: Enter submits the code; the result is announced and the field is cleared. */
export function ScanLotField({ scan, onAdd }: { scan: ScanState; onAdd: (code: string) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [code, setCode] = useState("");
  const submit = () => {
    onAdd(code);
    setCode("");
  };
  return (
    <div>
      <div className={styles.actions}>
        <TextField
          id={id}
          label={t("allocation.assignment.scan")}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          onKeyDown={enterKey(submit)}
        />
        <Button variant="secondary" onClick={submit}>
          {t("allocation.assignment.addLot")}
        </Button>
      </div>
      <ScanResult scan={scan} />
    </div>
  );
}
