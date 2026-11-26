import { useTranslation } from "react-i18next";
import { ModalDialog } from "../ui/ModalDialog";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import { TemporaryPasswordPanel } from "./TemporaryPasswordPanel";

interface Props {
  userId: string;
  name: string;
  onClose: () => void;
}

/** Mounted only while open, so closing it drops the password from memory. */
export function TemporaryPasswordDialog({ userId, name, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <ModalDialog title={t("users.password.title", { name })} onClose={onClose}>
      <TemporaryPasswordPanel userId={userId} />
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          {t("common.actions.close")}
        </Button>
      </DialogFooter>
    </ModalDialog>
  );
}
