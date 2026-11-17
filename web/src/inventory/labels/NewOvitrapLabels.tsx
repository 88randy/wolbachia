import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { MAX_NEW_OVITRAP_LABELS } from "../../labels/label-kinds";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import type { useNewOvitrapLabels } from "./use-new-ovitrap-labels";

type Model = ReturnType<typeof useNewOvitrapLabels>;

function GenerateButton({ model, reason }: { model: Model; reason: string }) {
  const { t } = useTranslation();
  const isInvalid = model.count === null;
  return (
    <Button
      leadingIcon={<Plus aria-hidden="true" />}
      loading={model.isBusy}
      disabled={isInvalid}
      title={isInvalid ? reason : undefined}
      onClick={() => {
        void model.generate();
      }}
    >
      {t("inventory.labels.newButton")}
    </Button>
  );
}

function CountRow({ model, reason }: { model: Model; reason: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <TextField
          id="new-ovitrap-labels-count"
          label={t("inventory.labels.newCount", { max: MAX_NEW_OVITRAP_LABELS })}
          type="text"
          inputMode="numeric"
          value={model.countText}
          aria-invalid={model.count === null}
          onChange={(event) => {
            model.setCountText(event.target.value);
          }}
        />
      </div>
      <GenerateButton model={model} reason={reason} />
    </div>
  );
}

/** "Generate new labels": how many, and one clear button. The new ones come back ticked. */
export function NewOvitrapLabels({ model }: { model: Model }) {
  const { t } = useTranslation();
  const reason = t("inventory.labels.newCountInvalid", { max: MAX_NEW_OVITRAP_LABELS });
  return (
    <Card title={t("inventory.labels.newTitle")}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13px] text-ink-2">{t("inventory.labels.newHelp")}</p>
        <CountRow model={model} reason={reason} />
        {model.count === null && <InlineNotice tone="warning">{reason}</InlineNotice>}
        {model.hasFailed && (
          <InlineNotice tone="critical">{t("inventory.labels.newError")}</InlineNotice>
        )}
      </div>
    </Card>
  );
}
