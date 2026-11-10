import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { unwrap } from "@wolbachia/api-client";
import { Bug, Plus, Shield } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { WizardPage } from "../../components/templates/WizardPage";
import { SearchField } from "../../forms/SearchField";
import { useFormatDate } from "../../format/use-formatters";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { useToast } from "../../ui/toast-context";
import { useLabScope } from "../use-lab-scope";
import { LabDialog } from "./LabDialog";
import { ChoiceCard, Fact, FactGrid, LabeledSelect } from "./PcrFields";
import { PCR_TARGETS, eligibleOptions, labsOptions, pcrErrorKey } from "./pcr-api";
import type { PcrSample, PcrTarget } from "./pcr-api";
import { targetKey } from "./pcr-status";

const ALL = "";

/** "Nueva prueba": 1 laboratory and targets, 2 samples, 3 review and create. */
export function PcrNewPage() {
  const { t } = useTranslation();
  const scope = useLabScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [labId, setLabId] = useState("");
  const [targets, setTargets] = useState<PcrTarget[]>(["wolbachia"]);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Map<string, PcrSample>>(new Map());
  const [problem, setProblem] = useState<string>();
  const labs = useQuery(labsOptions(scope, 1, true));
  const labOptions = (labs.data?.results ?? []).map((lab) => ({ value: lab.id, label: lab.name }));
  const lab = labs.data?.results.find((entry) => entry.id === labId);
  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await scope.client.POST("/api/v1/pcr-batches/", {
          body: {
            external_lab_id: labId,
            targets,
            sample_ids: [...selected.keys()],
            notes: notes.trim(),
          },
        }),
      ),
    onSuccess: (batch) => {
      void queryClient.invalidateQueries();
      showToast({ message: t("pcr.wizard.created", { code: batch.code }), tone: "success" });
      void navigate({ to: "/lab/pcr/$code", params: { code: batch.code } });
    },
    onError: (caught) => {
      setProblem(t(pcrErrorKey(caught)));
    },
  });
  const missing = (): string | undefined => {
    if (step === 1 && !labId) return t("pcr.wizard.needLab");
    if (step === 1 && targets.length === 0) return t("pcr.wizard.needTarget");
    if (step === 2 && selected.size === 0) return t("pcr.wizard.needSamples");
    return undefined;
  };
  const next = () => {
    const reason = missing();
    setProblem(reason);
    if (reason) return;
    if (step === 3) create.mutate();
    else setStep(step + 1);
  };
  const titles = [
    [t("pcr.wizard.step1"), t("pcr.wizard.step1Hint")],
    [t("pcr.wizard.step2"), t("pcr.wizard.step2Hint")],
    [t("pcr.wizard.step3"), t("pcr.wizard.step3Hint")],
  ] as const;
  const [stepTitle, stepDescription] = titles[step - 1] ?? titles[0];
  return (
    <WizardPage
      title={t("pcr.wizard.title")}
      step={step}
      total={3}
      stepTitle={stepTitle}
      stepDescription={stepDescription}
      notices={problem ? <InlineNotice tone="critical">{problem}</InlineNotice> : undefined}
      onBack={
        step > 1
          ? () => {
              setProblem(undefined);
              setStep(step - 1);
            }
          : undefined
      }
      onNext={next}
      isLastStep={step === 3}
      isBusy={create.isPending}
      nextLabel={step === 3 ? t("pcr.wizard.create") : undefined}
    >
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-3">
            <LabeledSelect
              className="w-full max-w-md"
              label={t("pcr.wizard.lab")}
              value={labId}
              options={labOptions}
              placeholder={t("pcr.wizard.labPlaceholder")}
              onChange={setLabId}
            />
            <LabDialog
              trigger={
                <Button variant="secondary" leadingIcon={<Plus aria-hidden="true" />}>
                  {t("pcr.wizard.addLab")}
                </Button>
              }
              onSaved={(saved) => {
                setLabId(saved.id);
              }}
            />
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold text-ink">{t("pcr.wizard.targets")}</legend>
            <div className="flex flex-wrap gap-3">
              {PCR_TARGETS.map((target) => (
                <ChoiceCard
                  key={target}
                  checked={targets.includes(target)}
                  title={t(targetKey(target))}
                  icon={target === "wolbachia" ? <Shield aria-hidden="true" className="size-5" /> : <Bug aria-hidden="true" className="size-5" />}
                  onToggle={() => {
                    setTargets((current) =>
                      current.includes(target)
                        ? current.filter((value) => value !== target)
                        : PCR_TARGETS.filter((value) => value === target || current.includes(value)),
                    );
                  }}
                />
              ))}
            </div>
          </fieldset>
          <label className="flex max-w-xl flex-col gap-1.5 text-[13px] font-semibold text-ink">
            {t("pcr.wizard.notes")}
            <textarea
              value={notes}
              maxLength={1000}
              rows={3}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
              onChange={(event) => {
                setNotes(event.currentTarget.value);
              }}
            />
          </label>
        </div>
      )}
      {step === 2 && <SampleChooser selected={selected} onChange={setSelected} />}
      {step === 3 && (
        <FactGrid>
          <Fact label={t("pcr.wizard.summaryLab")}>{lab?.name}</Fact>
          <Fact label={t("pcr.wizard.summaryTargets")}>
            {targets.map((target) => t(targetKey(target))).join(" · ")}
          </Fact>
          <Fact label={t("pcr.wizard.summarySamples")}>
            {[...selected.values()].map((sample) => sample.code).join(", ")}
          </Fact>
        </FactGrid>
      )}
    </WizardPage>
  );
}

function SampleChooser({
  selected,
  onChange,
}: {
  selected: Map<string, PcrSample>;
  onChange: (next: Map<string, PcrSample>) => void;
}) {
  const { t } = useTranslation();
  const scope = useLabScope();
  const formatDate = useFormatDate();
  const [quadrant, setQuadrant] = useState(ALL);
  const [week, setWeek] = useState(ALL);
  const [search, setSearch] = useState("");
  const facets = useQuery({
    queryKey: ["pcr-facets", scope.key],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/pcr-batches/eligible-samples/facets/", { signal })),
  });
  const rows = useQuery(eligibleOptions(scope, { quadrant, epiWeek: week, search, page: 1 }));
  const visible = rows.data?.results ?? [];
  const allOn = visible.length > 0 && visible.every((row) => selected.has(row.id));
  const toggle = (row: PcrSample) => {
    const nextSelection = new Map(selected);
    if (nextSelection.has(row.id)) nextSelection.delete(row.id);
    else nextSelection.set(row.id, row);
    onChange(nextSelection);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <LabeledSelect
          label={t("pcr.wizard.filterQuadrant")}
          value={quadrant}
          onChange={setQuadrant}
          options={[
            { value: ALL, label: t("pcr.wizard.allQuadrants") },
            ...(facets.data?.quadrants ?? []).map((entry) => ({
              value: entry.id,
              label: entry.code,
            })),
          ]}
        />
        <LabeledSelect
          label={t("pcr.wizard.filterWeek")}
          value={week}
          onChange={setWeek}
          options={[
            { value: ALL, label: t("pcr.wizard.allWeeks") },
            ...(facets.data?.weeks ?? []).map((entry) => ({ value: entry, label: entry })),
          ]}
        />
        <SearchField
          id="pcr-sample-search"
          label={t("pcr.wizard.searchSample")}
          value={search}
          maxLength={100}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-ink" aria-live="polite">
          {t("pcr.wizard.selected", { count: selected.size })}
        </p>
        {selected.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(new Map());
            }}
          >
            {t("pcr.wizard.clearSelection")}
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-muted text-left text-xs text-ink-2">
            <tr>
              <th className="w-10 px-3 py-2">
                <Checkbox
                  aria-label={t("pcr.wizard.selectPage")}
                  checked={allOn}
                  onCheckedChange={(checked) => {
                    const nextSelection = new Map(selected);
                    for (const row of visible) {
                      if (checked === true) nextSelection.set(row.id, row);
                      else nextSelection.delete(row.id);
                    }
                    onChange(nextSelection);
                  }}
                />
              </th>
              <th className="px-3 py-2 font-semibold">{t("pcr.col.code")}</th>
              <th className="px-3 py-2 font-semibold">{t("pcr.col.quadrant")}</th>
              <th className="px-3 py-2 font-semibold">{t("pcr.col.center")}</th>
              <th className="px-3 py-2 font-semibold">{t("pcr.col.week")}</th>
              <th className="px-3 py-2 font-semibold">{t("pcr.col.collected")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-line hover:bg-surface-muted"
                onClick={() => {
                  toggle(row);
                }}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    aria-label={row.code}
                    checked={selected.has(row.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onCheckedChange={() => {
                      toggle(row);
                    }}
                  />
                </td>
                <td className="px-3 py-2 font-semibold">{row.code}</td>
                <td className="px-3 py-2">{row.quadrant_code ?? "—"}</td>
                <td className="px-3 py-2">{row.center_name}</td>
                <td className="px-3 py-2">{row.epi_week ?? "—"}</td>
                <td className="px-3 py-2">{formatDate(row.collected_at)}</td>
              </tr>
            ))}
            {visible.length === 0 && !rows.isFetching && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-3">
                  {t("pcr.wizard.noSamples")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
