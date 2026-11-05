import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import styles from "./fleet.module.css";
import { MotorcycleCreateFields } from "./MotorcycleCreateFields";
import { MotorcycleCreateActions } from "./MotorcycleCreateActions";
import type { useCreateMotorcycle } from "./use-create-motorcycle";
interface Props {
  controller: ReturnType<typeof useCreateMotorcycle>;
  onClose: () => void;
}
export function CreateMotorcycleForm({ controller, onClose }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <form className={styles.content} onSubmit={controller.submit} noValidate>
      <MotorcycleCreateFields form={controller.form} />
      {controller.failure !== undefined && (
        <FormAlert
          id={id}
          ref={controller.alertRef}
          title={t("fleet.create.failure")}
          text={t(controller.failure)}
        />
      )}
      <MotorcycleCreateActions isBusy={controller.form.formState.isSubmitting} onClose={onClose} />
    </form>
  );
}
