import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useModalDialog } from "../../session/use-modal-dialog";
import type { GeographyScope } from "./use-w-15";
import { useCreateQuadrant } from "./use-create-quadrant";
import { QuadrantCreateFields } from "./QuadrantCreateFields";
import { CreateActions } from "./CreateActions";
import { WriteNotice } from "./WriteNotice";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  onClose: () => void;
}
export function QuadrantCreateDialog({ scope, onClose }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useModalDialog("input");
  const form = useCreateQuadrant(scope, onClose);
  const cancel = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!form.write.isBusy) onClose();
  };
  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={cancel}>
      <h2 id={id}>{t("geography.page.create")}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.create();
        }}
      >
        <QuadrantCreateFields form={form} />
        <CreateActions
          label="geography.page.create"
          isDisabled={form.isDisabled}
          isBusy={form.write.isBusy}
          onClose={onClose}
        />
      </form>
      <WriteNotice outcome={form.write.outcome} />
    </dialog>
  );
}
