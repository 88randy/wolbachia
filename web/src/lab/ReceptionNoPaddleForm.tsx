import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import { Button } from "../ui/Button";
import type { ReceptionActions } from "./use-reception-command";
import { useNoPaddleReception } from "./use-no-paddle-reception";
import styles from "./reception.module.css";

export function ReceptionNoPaddleForm({ actions }: { actions: ReceptionActions }) {
  const { t } = useTranslation();
  const form = useNoPaddleReception(actions);
  return (
    <form className={styles.scanForm} onSubmit={form.submit}>
      <TextField
        id="no-paddle-reading"
        label={t("labReception.scan.readingId")}
        hint={t("labReception.scan.noPaddleHint")}
        value={form.id}
        onChange={(event) => {
          form.setId(event.target.value);
        }}
      />
      <Button
        type="submit"
        loading={actions.isBusy}
        aria-disabled={!form.isValid || actions.isReviewRequired}
      >
        {t("labReception.action.receiveNoPaddle")}
      </Button>
    </form>
  );
}
