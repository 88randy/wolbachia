import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { useCountForm } from "./use-count-form";
export function CountFormActions({ form }: { form: ReturnType<typeof useCountForm> }) {
  const { t } = useTranslation();
  const kind = form.write.failure?.kind;
  if (kind === "confirm") return <Button onClick={() => { void form.submit(true); }} loading={form.write.isBusy}>{t("lab.count.confirm")}</Button>;
  if (kind === "uncertain") return <Button onClick={() => { void form.submit(); }} loading={form.write.isBusy}>{t("lab.count.retry")}</Button>;
  return <Button type="submit" loading={form.write.isBusy} aria-disabled={kind === "conflict"}>{t("lab.count.save")}</Button>;
}
