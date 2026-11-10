import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { ConditionCaptureFields } from "./ConditionCaptureFields";
import type { useConditionCapture } from "./use-condition-capture";
import styles from "../inventory.module.css";
interface Props {
  capture: ReturnType<typeof useConditionCapture>;
  status: Schemas["ConditionStatus"];
  ready: boolean;
  online: boolean;
}
export function ConditionCaptureForm({ capture, status, ready, online }: Props) {
  const { t } = useTranslation();
  const disabled = !online || !ready || capture.state.busy || capture.state.uncertain;
  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disabled) void capture.submit(status);
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <p>
        {status.timezone} · {t("conditions.field.timeHint")}
      </p>
      {!online && <InlineNotice tone="warning">{t("conditions.state.offline")}</InlineNotice>}
      <ConditionCaptureFields capture={capture} />
      <p role="status">{capture.state.message ? t(capture.state.message) : ""}</p>
      {!ready && <p>{t("conditions.state.verifying")}</p>}
      <Button type="submit" disabled={disabled}>
        {t("conditions.action.capture")}
      </Button>
    </form>
  );
}
