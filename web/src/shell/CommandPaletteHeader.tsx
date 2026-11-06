import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import styles from "./commands.module.css";
export function CommandPaletteHeader() {
  const { t } = useTranslation();
  return (
    <>
      <Dialog.Title className={styles.title}>{t("refresh.commands.title")}</Dialog.Title>
      <Dialog.Description className={styles.hint}>{t("refresh.commands.hint")}</Dialog.Description>
    </>
  );
}
