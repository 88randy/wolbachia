import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { NO_NAME } from "../../lookups/use-reference-names";
import styles from "../inventory.module.css";

type Lines = readonly Schemas["TransferLine"][];

/** The lot code of a line of this transfer; an unknown line reads "—", never an id. */
function lineName(lines: Lines, lineId: string) {
  return lines.find((line) => line.id === lineId)?.lot_code ?? NO_NAME;
}

function useManifestRows(manifest: Schemas["TransferManifest"], lines: Lines) {
  const { t } = useTranslation();
  const expected =
    manifest.lines?.map((line) => ({
      id: `expected-${line.id}`,
      label: `${lineName(lines, line.id)} · ${
        line.piece_id ? t("discrepancies.history.piece") : t("discrepancies.history.bulk")
      }`,
      quantity: line.quantity,
    })) ?? [];
  const received = Object.entries(manifest.received ?? {}).map(([id, quantity]) => ({
    id: `received-${id}`,
    label: `${t("discrepancies.history.received")} · ${lineName(lines, id)}`,
    quantity,
  }));
  const missing =
    manifest.missing?.map((line) => ({
      id: `missing-${line.line_id}`,
      label: `${t("discrepancies.kind.missing")} · ${lineName(lines, line.line_id)}`,
      quantity: line.quantity,
    })) ?? [];
  return [...expected, ...received, ...missing];
}
export function DiscrepancyManifest({
  manifest,
  lines,
}: {
  manifest: Schemas["TransferManifest"];
  lines: Lines;
}) {
  const rows = useManifestRows(manifest, lines);
  return (
    <dl className={styles.summary}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.quantity}</dd>
        </div>
      ))}
    </dl>
  );
}
