import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
interface Props {
  label: MessageKey;
  isDisabled: boolean;
  isBusy: boolean;
  onClose?: () => void;
}
export function CreateActions({ label, isDisabled, isBusy, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <div>
      <button type="submit" disabled={isDisabled}>
        {t(label)}
      </button>
      {onClose && (
        <button type="button" disabled={isBusy} onClick={onClose}>
          {t("common.actions.close")}
        </button>
      )}
    </div>
  );
}
