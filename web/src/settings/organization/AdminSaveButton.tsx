import { useTranslation } from "react-i18next";
import { SubmitButton } from "../../forms/SubmitButton";
interface Props {
  isBlocked: boolean;
  isBusy: boolean;
}
export function AdminSaveButton({ isBlocked, isBusy }: Props) {
  const { t } = useTranslation();
  return (
    <SubmitButton
      label={t("common.actions.save")}
      busyLabel={t(isBusy ? "orgAdmin.action.saving" : "common.actions.save")}
      isBusy={isBlocked}
    />
  );
}
