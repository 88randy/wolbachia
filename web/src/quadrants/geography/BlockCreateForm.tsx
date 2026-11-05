import { useTranslation } from "react-i18next";
import { useCreateBlock } from "./use-create-block";
import type { CreateBlockOptions } from "./use-create-block";
import { BlockCreateFields } from "./BlockCreateFields";
import { CreateActions } from "./CreateActions";
import { WriteNotice } from "./WriteNotice";
import { FourPointForm } from "./FourPointForm";
import styles from "./geography.module.css";
export function BlockCreateForm(options: CreateBlockOptions) {
  const { t } = useTranslation();
  const { scope, proposal } = options;
  const form = useCreateBlock(options);
  const label = proposal ? "geography.blocks.accept" : "geography.blocks.create";
  return (
    <section className={styles.card}>
      <h3>{t(label)}</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.create();
        }}
      >
        <BlockCreateFields form={form} />
        <CreateActions
          label={label}
          isDisabled={form.isDisabled || form.write.isBusy || form.saved !== null}
          isBusy={form.write.isBusy}
        />
      </form>
      <WriteNotice outcome={form.write.outcome} />
      {form.saved && scope.canCreatePoint && (
        <FourPointForm scope={scope} block={form.saved} locations={proposal?.points ?? []} />
      )}
    </section>
  );
}
