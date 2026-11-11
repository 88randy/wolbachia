import { Plus } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormActions, FormField, FormGrid } from "../../../components/templates/FormGrid";
import { FormSection } from "../../../components/templates/FormSection";
import { PageFrame } from "../../../components/templates/PageFrame";
import { PageHeader } from "../../../components/templates/PageHeader";
import { useDocumentTitle } from "../../../shell/use-document-title";
import { Button } from "../../../ui/Button";
import { ErrorState } from "../../../ui/ErrorState";
import { InlineNotice } from "../../../ui/InlineNotice";
import { LocationCombobox } from "../../LocationCombobox";
import { TransferLineRow } from "./TransferLineRow";
import { useNewTransfer } from "./use-new-transfer";
import type { NewTransfer } from "./use-new-transfer";

function RouteSection({ form }: { form: NewTransfer }) {
  const { t } = useTranslation();
  return (
    <FormSection title={t("transfers.new.section.route")}>
      <FormGrid>
        <FormField>
          <LocationCombobox
            id="transfer-origin"
            label={t("transfers.new.origin")}
            value={form.draft.originId}
            excludeId={form.draft.destinationId}
            onChange={form.setOrigin}
          />
        </FormField>
        <FormField>
          <LocationCombobox
            id="transfer-destination"
            label={t("transfers.new.destination")}
            value={form.draft.destinationId}
            excludeId={form.draft.originId}
            onChange={form.setDestination}
          />
        </FormField>
      </FormGrid>
    </FormSection>
  );
}

function ItemsSection({ form }: { form: NewTransfer }) {
  const { t } = useTranslation();
  const { stock, draft } = form;
  const hasOrigin = draft.originId !== "";
  return (
    <FormSection
      title={t("transfers.new.section.items")}
      description={t(hasOrigin ? "transfers.new.itemsHint" : "transfers.new.pickOriginFirst")}
    >
      {hasOrigin && stock.isError && <ErrorState onRetry={stock.refetch} />}
      {hasOrigin && !stock.isLoading && !stock.isError && stock.choices.size === 0 && (
        <InlineNotice tone="warning">{t("transfers.new.noStock")}</InlineNotice>
      )}
      {hasOrigin && stock.choices.size > 0 && (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {draft.lines.map((line, index) => (
            <TransferLineRow
              key={line.key}
              line={line}
              index={index}
              choices={stock.choices}
              isDisabled={form.isBusy}
              onChange={(next) => {
                form.setLine(line.key, next);
              }}
              onRemove={() => {
                form.removeLine(line.key);
              }}
            />
          ))}
        </ul>
      )}
      {hasOrigin && stock.choices.size > 0 && (
        <div>
          <Button
            variant="secondary"
            leadingIcon={<Plus aria-hidden="true" />}
            onClick={form.addLine}
          >
            {t("transfers.new.item.add")}
          </Button>
        </div>
      )}
    </FormSection>
  );
}

/** W12: prepare a shipment between two warehouses. Sending and receiving happen on its record. */
export function NewTransferPage() {
  const { t } = useTranslation();
  const form = useNewTransfer();
  const blockedId = useId();
  useDocumentTitle(t("transfers.new.title"));
  const isBlocked = form.blockers.length > 0;
  return (
    <PageFrame width="narrow">
      <PageHeader title={t("transfers.new.title")} description={t("transfers.new.description")} />
      <form
        aria-label={t("transfers.new.title")}
        className="flex min-w-0 flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <RouteSection form={form} />
        <ItemsSection form={form} />
        {form.failure && (
          <InlineNotice tone="warning">
            <p>{t(form.failure.key)}</p>
            {form.failure.reasons.map((key) => (
              <p key={key}>{t(key)}</p>
            ))}
          </InlineNotice>
        )}
        <FormActions>
          {isBlocked && (
            <p id={blockedId} className="m-0 mr-auto text-[13px] text-ink-2">
              {t(form.blockers[0] ?? "transfers.new.blocker.items")}
            </p>
          )}
          <Button
            type="submit"
            loading={form.isBusy}
            aria-disabled={isBlocked || undefined}
            aria-describedby={isBlocked ? blockedId : undefined}
          >
            {t("transfers.new.submit")}
          </Button>
        </FormActions>
      </form>
    </PageFrame>
  );
}
