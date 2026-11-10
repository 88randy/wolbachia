import { TypeMetadataFields } from "./TypeMetadataFields";
import { TypeNumberFields } from "./TypeNumberFields";
import { TypeBlockerFields } from "./TypeBlockerFields";
import { TypeOwners } from "./TypeOwners";
import type { EditorFormProps } from "./TypeEditorForm";
import styles from "./incident-types.module.css";
export function TypeEditorFields({ controller, scope, item, isReady }: EditorFormProps) {
  const fields = {
    draft: controller.draft,
    change: controller.change,
    item,
    fields: controller.writer.fields,
  };
  const disabled = controller.writer.isBusy || !isReady || !scope.identity.isSettled;
  return (
    <fieldset className={styles.fields} disabled={disabled}>
      <TypeMetadataFields {...fields} />
      <TypeNumberFields {...fields} />
      <TypeOwners scope={scope} controller={controller} item={item} />
      <TypeBlockerFields {...fields} />
    </fieldset>
  );
}
