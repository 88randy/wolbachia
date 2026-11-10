import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import type { useCountForm } from "./use-count-form";

function PrimaryAction({ form }: { form: ReturnType<typeof useCountForm> }) {
  const { t } = useTranslation();
  const kind = form.write.failure?.kind;
  if (kind === "confirm" || kind === "uncertain")
    return (
      <Button
        size="xl"
        className="flex-1 text-base"
        onClick={() => {
          void form.submit(kind === "confirm");
        }}
        loading={form.write.isBusy}
      >
        {t(kind === "confirm" ? "lab.count.confirm" : "lab.count.retry")}
      </Button>
    );
  return (
    <Button
      type="submit"
      size="xl"
      className="flex-1 text-base"
      loading={form.write.isBusy}
      aria-disabled={kind === "conflict"}
    >
      {t("lab.count.save")} <kbd aria-hidden="true">{t("lab.count.enterKey")}</kbd>
    </Button>
  );
}

/** Primary "save and next" plus the secondary damaged-paddle action (blocked, with its reason). */
export function CountFormActions({ form }: { form: ReturnType<typeof useCountForm> }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-3">
      <PrimaryAction form={form} />
      <Tooltip content={t("lab.count.damagedBlocked")}>
        <Button
          size="xl"
          variant="secondary"
          aria-disabled="true"
          leadingIcon={<TriangleAlert aria-hidden="true" />}
        >
          {t("lab.count.damaged")}
        </Button>
      </Tooltip>
    </div>
  );
}
