import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import styles from "../inventory.module.css";

function useManifestRows(manifest: Schemas["TransferManifest"]) {
  const { t } = useTranslation();
  const expected =
    manifest.lines?.map((line) => ({
      id: `expected-${line.id}`,
      label: `${line.lot_id} · ${line.piece_id ?? t("discrepancies.history.bulk")}`,
      quantity: line.quantity,
    })) ?? [];
  const received = Object.entries(manifest.received ?? {}).map(([id, quantity]) => ({
    id: `received-${id}`,
    label: `${t("discrepancies.history.received")} · ${id}`,
    quantity,
  }));
  const missing =
    manifest.missing?.map((line) => ({
      id: `missing-${line.line_id}`,
      label: `${t("discrepancies.kind.missing")} · ${line.line_id}`,
      quantity: line.quantity,
    })) ?? [];
  return [...expected, ...received, ...missing];
}
export function DiscrepancyManifest({ manifest }: { manifest: Schemas["TransferManifest"] }) {
  const rows = useManifestRows(manifest);
  return (
    <dl className={styles.summary}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt className={styles.mono}>{row.label}</dt>
          <dd>{row.quantity}</dd>
        </div>
      ))}
    </dl>
  );
}
