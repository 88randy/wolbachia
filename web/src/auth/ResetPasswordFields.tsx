import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PasswordField } from "../forms/PasswordField";
import { useFieldError } from "../forms/use-field-error";
import type { ResetValues } from "./reset-schema";

/** The new password and its confirmation, both `new-password` so managers offer to save it. */
export function ResetPasswordFields({ form }: { form: UseFormReturn<ResetValues> }) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { register, formState } = form;
  return (
    <>
      <PasswordField
        id="reset-new-password"
        label={t("auth.reset.newPassword")}
        hint={t("auth.reset.hint")}
        autoComplete="new-password"
        error={fieldError(formState.errors.newPassword)}
        {...register("newPassword")}
      />
      <PasswordField
        id="reset-confirm-password"
        label={t("auth.reset.confirmPassword")}
        autoComplete="new-password"
        error={fieldError(formState.errors.confirmPassword)}
        {...register("confirmPassword")}
      />
    </>
  );
}
