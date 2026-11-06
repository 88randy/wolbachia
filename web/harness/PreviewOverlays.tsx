import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { CardMenu } from "../src/ui/CardMenu";
import { Button } from "../src/ui/Button";
import { Dialog } from "../src/ui/Dialog";
import { SideSheet } from "../src/ui/SideSheet";
import { ConfirmDialog } from "../src/ui/ConfirmDialog";
import { Tooltip } from "../src/ui/Tooltip";
import { useToast } from "../src/ui/ToastProvider";
import styles from "./PreviewComponents.module.css";
interface PreviewOverlaysProps {
  onOpenPalette: () => void;
  onOpenHelp: () => void;
}
export function PreviewOverlays({ onOpenPalette, onOpenHelp }: PreviewOverlaysProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const review = () => {
    showToast({ message: t("refresh.preview.reviewToast") });
  };
  return (
    <Card
      title={t("refresh.preview.overlays")}
      actions={
        <CardMenu
          label={t("refresh.preview.cardMenu")}
          items={[{ label: t("refresh.preview.cardMenuAction"), onSelect: review }]}
        />
      }
    >
      <div className={styles.stack}>
        <Dialog
          trigger={<Button variant="secondary">{t("refresh.preview.dialog")}</Button>}
          title={t("refresh.preview.dialogTitle")}
          description={t("refresh.preview.dialogDescription")}
        >
          <p className={styles.label}>{t("refresh.preview.details")}</p>
        </Dialog>
        <SideSheet
          trigger={<Button variant="tertiary">{t("refresh.preview.sheet")}</Button>}
          title={t("refresh.preview.sheetTitle")}
          description={t("refresh.preview.dialogDescription")}
        >
          <p className={styles.label}>{t("refresh.preview.details")}</p>
        </SideSheet>
        <ConfirmDialog
          trigger={<Button variant="tertiary">{t("refresh.preview.confirm")}</Button>}
          title={t("refresh.preview.confirm")}
          consequence={t("refresh.preview.consequence")}
          actionLabel={t("refresh.preview.voidAction")}
          onConfirm={() => {
            showToast({ message: t("ui.preview.voided"), tone: "success" });
          }}
        />
        <Tooltip content={t("refresh.commands.hint")}>
          <Button variant="ghost" onClick={onOpenPalette}>
            {t("refresh.preview.palette")}
          </Button>
        </Tooltip>
        <Button variant="ghost" onClick={onOpenHelp}>
          {t("refresh.preview.help")}
        </Button>
      </div>
    </Card>
  );
}
