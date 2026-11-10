import { useTranslation } from "react-i18next";
import { MapPolygonPicker } from "../../map-picker/MapPolygonPicker";
import { InlineNotice } from "../../ui/InlineNotice";
import { parsePolygon } from "./permit-geometry";
import { PermitChoiceField } from "./PermitChoiceField";
import { PermitDocumentSection } from "./PermitDocumentSection";
import { PermitTextFields } from "./PermitTextFields";
import type { usePermitForm } from "./use-permit-form";

interface Props {
  form: ReturnType<typeof usePermitForm>;
  /** Appending a version: the code and the quadrant of the permit are not editable. */
  isVersion: boolean;
}

/** Fields of the permit form (presentational: all state comes from `usePermitForm`). */
export function PermitFormFields({ form, isVersion }: Props) {
  const { t } = useTranslation();
  const geometryError = form.errors.geometry;
  return (
    <>
      {!isVersion && <PermitTextFields form={form} names={["code"]} />}
      {!isVersion && <PermitChoiceField form={form} field="quadrant" />}
      <PermitChoiceField form={form} field="type" />
      <PermitTextFields form={form} names={["number", "authority"]} />
      <PermitDocumentSection form={form} />
      <PermitTextFields form={form} names={["attestation"]} />
      <MapPolygonPicker
        label={t("permits.form.geometry")}
        value={parsePolygon(form.draft.geometry)}
        onChange={(polygon) => {
          form.change("geometry", polygon ? JSON.stringify(polygon) : "");
        }}
      />
      {geometryError !== undefined && (
        <InlineNotice tone="critical">{t(geometryError)}</InlineNotice>
      )}
      <PermitTextFields form={form} names={["validFrom", "validTo"]} />
    </>
  );
}
