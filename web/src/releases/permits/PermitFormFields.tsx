import { PermitChoiceField } from "./PermitChoiceField";
import { PermitDocumentSection } from "./PermitDocumentSection";
import { PermitTextFields } from "./PermitTextFields";
import { ZoneField } from "./ZoneField";
import type { usePermitForm } from "./use-permit-form";

interface Props {
  form: ReturnType<typeof usePermitForm>;
  /** Appending a version: the code and the quadrant of the permit are not editable. */
  isVersion: boolean;
}

/** Fields of the permit form (presentational: all state comes from `usePermitForm`). */
export function PermitFormFields({ form, isVersion }: Props) {
  return (
    <>
      {!isVersion && <PermitTextFields form={form} names={["code"]} />}
      {!isVersion && <PermitChoiceField form={form} field="quadrant" />}
      <PermitChoiceField form={form} field="type" />
      <PermitTextFields form={form} names={["number", "authority"]} />
      <PermitDocumentSection form={form} />
      <PermitTextFields form={form} names={["attestation"]} />
      <ZoneField form={form} />
      <PermitTextFields form={form} names={["validFrom", "validTo"]} />
    </>
  );
}
