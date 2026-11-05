import type { UseFormReturn } from "react-hook-form";
import type { MotorcycleValues } from "./motorcycle-schema";
import { MotorcycleCreateField } from "./MotorcycleCreateField";
export function MotorcycleCreateFields({ form }: { form: UseFormReturn<MotorcycleValues> }) {
  return (
    <>
      <MotorcycleCreateField form={form} name="code" />
      <MotorcycleCreateField form={form} name="plate" />
    </>
  );
}
