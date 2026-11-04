import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

// W35 shape: one big numeric field, fixed focus, Enter saves. Error carries a code, text comes from i18n.
const schema = z.object({ value: z.coerce.number().int("not_integer").min(0, "not_integer") });
type Input = z.input<typeof schema>;

export function CountForm() {
  const { t } = useTranslation();
  const { register, handleSubmit, setFocus, reset, formState } = useForm<Input, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
  });
  return (
    <main>
      <form
        onSubmit={handleSubmit(() => {
          reset();
          setFocus("value"); // focus never leaves the field
        })}
      >
        <label>
          {t("count.label")}
          <input inputMode="numeric" autoFocus aria-invalid={!!formState.errors.value} {...register("value")} />
        </label>
        {formState.errors.value && <p role="alert">{t("error.not_integer")}</p>}
        <button type="submit">{t("count.save")}</button>
      </form>
    </main>
  );
}
