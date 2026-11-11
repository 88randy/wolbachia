import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { FormActions, FormField, FormGrid } from "../components/templates/FormGrid";
import { DateField } from "../ui/DateField";
import { FormSection } from "../components/templates/FormSection";
import { TextField } from "../forms/TextField";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useSessionIdentity } from "../session/use-session-identity";
import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import { SelectMenu } from "../ui/SelectMenu";
import { useToast } from "../ui/toast-context";
import { BlockPicker } from "./BlockPicker";
import { interventionTypesOptions } from "./scheduling-queries";
import { failureKey } from "./use-scheduling-writes";

/** The form of a third-party intervention. Nothing is deleted later: wrong ones are corrected by a new record. */
export function InterventionForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const types = useQuery(interventionTypesOptions(client, identity)).data ?? [];
  const [type, setType] = useState("");
  const [other, setOther] = useState("");
  const [product, setProduct] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [blocks, setBlocks] = useState<string[]>([]);
  const [isTried, setIsTried] = useState(false);
  const isOther = types.find((item) => item.id === type)?.is_other === true;
  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await client.POST("/api/v1/third-party-interventions/", {
          body: {
            type,
            product: product.trim(),
            source: source.trim(),
            blocks,
            date_from: from,
            date_to: to,
            other_text: isOther ? other.trim() : "",
          },
        }),
      ),
    onSuccess: async () => {
      await invalidateOrgScoped(queryClient, "interventions");
      showToast({ message: t("scheduling.intervention.saved"), tone: "success" });
      onDone();
    },
  });
  const required = t("scheduling.intervention.required");
  const rangeError =
    from !== "" && to !== "" && to < from ? t("scheduling.intervention.badRange") : undefined;
  const missing = (value: string) => (isTried && value.trim() === "" ? required : undefined);
  const isValid =
    type !== "" &&
    product.trim() !== "" &&
    source.trim() !== "" &&
    from !== "" &&
    to !== "" &&
    blocks.length > 0 &&
    (!isOther || other.trim() !== "") &&
    rangeError === undefined;
  const serverError = create.error instanceof ApiError ? create.error : undefined;
  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setIsTried(true);
        if (isValid) create.mutate();
      }}
    >
      <FormSection title={t("scheduling.intervention.sectionWhat")}>
        <FormGrid>
          <FormField width="full">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="intervention-type" className="text-[13px] font-semibold text-ink">
                {t("scheduling.intervention.type")}
              </label>
              <SelectMenu
                id="intervention-type"
                value={type}
                onValueChange={setType}
                placeholder={t("scheduling.intervention.typePlaceholder")}
                invalid={isTried && type === ""}
                options={types.map((item) => ({ value: item.id, label: item.label_es }))}
              />
              {isTried && type === "" && <p className="m-0 text-xs text-critical-fg">{required}</p>}
            </div>
          </FormField>
          {isOther && (
            <FormField width="full">
              <TextField
                id="intervention-other"
                label={t("scheduling.intervention.other")}
                value={other}
                error={missing(other)}
                onChange={(event) => {
                  setOther(event.target.value);
                }}
              />
            </FormField>
          )}
          <FormField width="full">
            <TextField
              id="intervention-product"
              label={t("scheduling.intervention.product")}
              value={product}
              maxLength={200}
              error={missing(product)}
              onChange={(event) => {
                setProduct(event.target.value);
              }}
            />
          </FormField>
        </FormGrid>
      </FormSection>
      <FormSection title={t("scheduling.intervention.sectionWho")}>
        <FormGrid>
          <FormField width="full">
            <TextField
              id="intervention-source"
              label={t("scheduling.intervention.institution")}
              value={source}
              maxLength={200}
              error={missing(source)}
              onChange={(event) => {
                setSource(event.target.value);
              }}
            />
          </FormField>
          <FormField width="short">
            <DateField
              id="intervention-from"
              label={t("scheduling.intervention.from")}
              value={from}
              onChange={setFrom}
              error={missing(from)}
            />
          </FormField>
          <FormField width="short">
            <DateField
              id="intervention-to"
              label={t("scheduling.intervention.to")}
              value={to}
              onChange={setTo}
              error={missing(to) ?? rangeError}
            />
          </FormField>
        </FormGrid>
      </FormSection>
      <FormSection title={t("scheduling.intervention.sectionWhere")}>
        <BlockPicker
          selected={blocks}
          onChange={setBlocks}
          {...(isTried && blocks.length === 0
            ? { error: t("scheduling.intervention.needBlocks") }
            : {})}
        />
      </FormSection>
      {create.isError && (
        <InlineNotice tone="critical">
          <p>
            {t(
              serverError?.status === 400
                ? "scheduling.intervention.invalid"
                : failureKey(create.error),
            )}
          </p>
        </InlineNotice>
      )}
      <FormActions>
        <Button variant="tertiary" onClick={onDone}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" loading={create.isPending}>
          {t("common.actions.save")}
        </Button>
      </FormActions>
    </form>
  );
}
