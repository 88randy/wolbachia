import { Switch } from "../ui/Switch";
import type { VersionFieldProps } from "./VersionValueField";

/** A yes/no parameter: the switch states the option it is on ("Sí" / "No") in its label. */
export function VersionSwitchField({
  form,
  value,
  label,
}: Pick<VersionFieldProps, "form"> & { value: string; label: string }) {
  return (
    <Switch
      label={label}
      isOn={value === "1"}
      onChange={(isOn) => {
        form.setValue("value", isOn ? "1" : "0", { shouldDirty: true });
      }}
    />
  );
}
