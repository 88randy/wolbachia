import type { UseFormReturn } from "react-hook-form";
import type { MotorcycleValues } from "./motorcycle-schema";
import { useTranslation } from "react-i18next";
import { FormField, FormGrid } from "../components/templates/FormGrid";
import { FormSection } from "../components/templates/FormSection";
import { MotorcycleCreateField } from "./MotorcycleCreateField";
export function MotorcycleCreateFields({ form }: { form: UseFormReturn<MotorcycleValues> }) {
  const { t } = useTranslation();
  return (
    <FormSection title={t("fleet.summary.identity")}>
      <FormGrid>
        <FormField>
          <MotorcycleCreateField form={form} name="code" />
        </FormField>
        <FormField>
          <MotorcycleCreateField form={form} name="plate" />
        </FormField>
      </FormGrid>
    </FormSection>
  );
}
