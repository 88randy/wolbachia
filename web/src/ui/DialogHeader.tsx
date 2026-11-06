import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import styles from "./ui.module.css";
export function DialogHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <header className={styles.dialogHeader}>
      <Primitive.Title className={styles.cardTitle}>{title}</Primitive.Title>
      <Primitive.Close asChild>
        <Button variant="ghost" size="sm" aria-label={t("common.actions.close")}>
          <X aria-hidden="true" strokeWidth={1.5} />
        </Button>
      </Primitive.Close>
    </header>
  );
}
