import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { DialogFooter } from "../../ui/DialogFooter";
import styles from "./geography.module.css";
interface Props {
  label: MessageKey;
  isDisabled: boolean;
  isBusy: boolean;
  onClose?: () => void;
}
export function CreateActions({ label, isDisabled, isBusy, onClose }: Props) {
  const { t } = useTranslation();
  const submit = (
    <button
      type="submit"
      disabled={isDisabled}
      className={onClose ? styles.createPrimary : undefined}
    >
      {t(label)}
    </button>
  );
  if (!onClose) return <div>{submit}</div>;
  return (
    <DialogFooter>
      <button type="button" className={styles.createSecondary} disabled={isBusy} onClick={onClose}>
        {t("common.actions.cancel")}
      </button>
      {submit}
    </DialogFooter>
  );
}
