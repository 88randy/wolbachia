import { PointInputFields } from "./PointInputFields";
import type { FourPoints } from "./use-four-points";
export function FourPointInputs({ form }: { form: FourPoints }) {
  return (
    <>
      {form.inputs.map((input, index) => (
        <PointInputFields
          key={index}
          value={input}
          isDisabled={
            form.isRunning || Boolean(form.reconciliation.uncertain) || index < form.created.length
          }
          onChange={(value) => {
            form.setInputs((previous) =>
              previous.map((item, position) => (position === index ? value : item)),
            );
          }}
        />
      ))}
    </>
  );
}
