import { ArrowRight, ListChecks, RotateCw } from "lucide-react-native";
import { useEffect } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { OpenFrame } from "./OpenFrame.tsx";
import { SafetyItem } from "./SafetyItem.tsx";
import type { Check } from "./domain.ts";
import { useCatalogDownload } from "./use-catalog-download.ts";
import type { M04Model } from "./use-m-04.ts";

const INCOMPLETE = ["unconfigured", "checklist", "note", "catalogChanged"];

/** The list changed while the draft was empty: adopt it silently, nothing to re-check yet. */
function useAdoptNewList(model: M04Model): void {
  const isEmptyDraft = model.state?.draft?.checks.length === 0;
  const hasChanged = model.state?.gate === "catalogChanged";
  const { run, service } = model;
  useEffect(() => {
    if (isEmptyDraft && hasChanged) void run(() => service.confirmCatalog());
  }, [isEmptyDraft, hasChanged, run, service]);
}

/** Step 2 of 4: the safety check. The list is downloaded by the app, never asked from the courier. */
export function P5Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  const download = useCatalogDownload(model);
  useAdoptNewList(model);
  const draft = model.state?.draft;
  const items = model.state?.catalog?.items ?? [];
  const gate = model.state?.gate ?? null;
  if (!draft) return null;
  const isIncomplete = INCOMPLETE.includes(gate ?? "");
  const pending = items.filter((item) => !draft.checks.some((check) => check.item === item.code));
  const change = (check: Check) => {
    model.edit({
      checks: [...draft.checks.filter((current) => current.item !== check.item), check],
    });
  };
  return (
    <OpenFrame
      model={model}
      step="checklist"
      footer={
        <PrimaryButton
          icon={ArrowRight}
          label={t("field.action.next")}
          disabled={model.isBusy || isIncomplete}
          onPress={() => {
            void model.run(() => model.service.update({ step: "odometer" }));
          }}
        />
      }
    >
      <StepQuestion title={t("field.open.checkQuestion")} hint={t("field.open.checkHint")} />
      {gate === "catalogChanged" && draft.checks.length > 0 ? (
        <>
          <InfoNotice tone="warning" message={t("field.open.listChanged")} />
          <SecondaryButton
            icon={RotateCw}
            label={t("field.open.listChangedAction")}
            disabled={model.isBusy}
            onPress={() => {
              void model.run(() => model.service.confirmCatalog());
            }}
          />
        </>
      ) : null}
      {items.length === 0 ? (
        download.isLoading ? (
          <Skeleton />
        ) : (
          <EmptyState
            icon={ListChecks}
            title={t("field.open.noChecklist")}
            message={t("field.open.noChecklistHint")}
            actionLabel={t("field.action.retry")}
            actionIcon={RotateCw}
            onAction={download.retry}
          />
        )
      ) : (
        items.map((item) => (
          <SafetyItem
            key={item.code}
            item={item}
            check={draft.checks.find((check) => check.item === item.code)}
            onChange={change}
          />
        ))
      )}
      {items.length > 0 && isIncomplete && gate !== "catalogChanged" ? (
        <InfoNotice
          tone="info"
          message={
            pending.length > 0
              ? t("field.open.checksMissing", { count: pending.length })
              : t("field.open.noteMissing")
          }
        />
      ) : null}
    </OpenFrame>
  );
}
