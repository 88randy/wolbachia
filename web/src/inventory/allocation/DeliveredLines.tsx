import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import type { AssignmentDraft } from "./use-assignment-draft";
import styles from "../inventory.module.css";

/** Editable delivered quantity per scanned lot; removing only edits the draft, no record exists yet. */
export function DeliveredLines({ draft }: { draft: AssignmentDraft }) {
  const { t } = useTranslation();
  return (
    <ul className={styles.list}>
      {draft.lines.map((line) => (
        <li key={line.key} className={styles.actions}>
          <TextField
            id={`delivered-${line.key}`}
            label={t("allocation.assignment.lineQuantity", { code: line.lotCode })}
            inputMode="decimal"
            value={line.quantity}
            onChange={(event) => {
              draft.setQuantity(line.key, event.target.value);
            }}
          />
          <Button
            variant="tertiary"
            onClick={() => {
              draft.removeLine(line.key);
            }}
          >
            {t("allocation.assignment.removeLine", { code: line.lotCode })}
          </Button>
        </li>
      ))}
    </ul>
  );
}
