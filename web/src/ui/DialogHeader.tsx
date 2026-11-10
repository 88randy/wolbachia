import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { DIALOG_TITLE_CLASS } from "./overlay-classes";
export function DialogHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <header className="-mb-2 flex items-start justify-between gap-4">
      <Primitive.Title className={DIALOG_TITLE_CLASS}>{title}</Primitive.Title>
      <Primitive.Close asChild>
        <Button
          variant="ghost"
          size="sm"
          className="-mt-1 -mr-2 px-2"
          aria-label={t("common.actions.close")}
        >
          <X aria-hidden="true" strokeWidth={1.75} />
        </Button>
      </Primitive.Close>
    </header>
  );
}
