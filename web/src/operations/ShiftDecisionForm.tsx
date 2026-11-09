import { useTranslation } from "react-i18next";
import { DialogFooter } from "../ui/DialogFooter";
import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import { ShiftReasonField } from "./ShiftReasonField";
import type { ShiftDecisionFormState } from "./use-shift-decision";
import styles from "./shifts.module.css";
interface Props { form: ShiftDecisionFormState; label: string; onSubmit: () => Promise<void>; onCancel: () => void }
function focusCancel(button: HTMLButtonElement | null) { button?.focus(); }
export function ShiftDecisionForm({ form, label, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      <ShiftReasonField form={form} />
      <div role="alert">{form.failure && <InlineNotice tone="critical">{t(form.failure)}</InlineNotice>}</div>
      {form.isBlocked && !form.failure && <InlineNotice tone="warning">{t("shift.blocker.refresh")}</InlineNotice>}
      <DialogFooter>
        <Button variant="secondary" ref={focusCancel} aria-disabled={form.isBusy} onClick={onCancel}>{t("common.actions.cancel")}</Button>
        <Button type="submit" loading={form.isBusy} aria-disabled={form.isBlocked}>{label}</Button>
      </DialogFooter>
    </form>
  );
}
