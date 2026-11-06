import type { ComponentProps } from "react";
import { TextField } from "./TextField";
import { useBlurValidation } from "./use-blur-validation";
interface ValidatedTextFieldProps extends Omit<ComponentProps<typeof TextField>, "error"> {
  validate: (value: string) => string | undefined;
}
export function ValidatedTextField({
  validate,
  onBlur,
  onChange,
  ...props
}: ValidatedTextFieldProps) {
  const validation = useBlurValidation(validate);
  return (
    <TextField
      {...props}
      error={validation.error}
      onBlur={(event) => {
        validation.onBlur(event.currentTarget.value);
        onBlur?.(event);
      }}
      onChange={(event) => {
        validation.onChange(event.currentTarget.value);
        onChange?.(event);
      }}
    />
  );
}
