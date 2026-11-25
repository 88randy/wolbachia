/* eslint-disable max-lines-per-function -- declarative form JSX with shared accessible controls. */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterLookup } from "../data-table/FilterLookup";
import { TextField } from "../forms/TextField";
import { holdsAny } from "../lookups/lookup-permissions";
import { PERSON_LOOKUP } from "../lookups/lookup-sources";
import { ExportChoice } from "../regulatory/exports/ExportChoice";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { InlineNotice } from "../ui/InlineNotice";
import { Switch } from "../ui/Switch";
import type { LabScope } from "./lab-query";
import type { ExportDateError } from "./annotation-export-domain";
import { validateExportDates } from "./annotation-export-domain";
import { useAnnotationExportCreate } from "./use-annotation-export-create";

const AUTHOR_FILTER = {
  kind: "text",
  key: "author",
  labelKey: "annotationExport.form.author",
  maxLength: 36,
  lookup: PERSON_LOOKUP,
} as const;
const FORMATS = ["coco", "yolo"] as const;

/** W72 filters describe the server archive; no training data is assembled in the browser. */
export function AnnotationExportForm({ scope }: { scope: LabScope }) {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [author, setAuthor] = useState<string>();
  const [includeVoided, setIncludeVoided] = useState(false);
  const [format, setFormat] = useState<"coco" | "yolo">("coco");
  const [error, setError] = useState<ExportDateError | null>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const command = useAnnotationExportCreate(scope);
  const canPickAuthor = holdsAny(scope.identity.permissions, PERSON_LOOKUP.permission);
  return (
    <Card title={t("annotationExport.form.title")} headingLevel={2}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const invalid = validateExportDates(from, to);
          setError(invalid);
          if (invalid !== null) {
            fromRef.current?.focus();
            return;
          }
          void command.submit({
            date_from: from,
            date_to: to,
            include_voided: includeVoided,
            format,
            ...(canPickAuthor && author ? { author } : {}),
          });
        }}
      >
        <p className="m-0 text-sm text-ink-2">{t("annotationExport.form.hint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            ref={fromRef}
            id="annotation-export-from"
            name="date_from"
            type="date"
            autoComplete="off"
            label={t("annotationExport.form.from")}
            value={from}
            error={error === null ? undefined : t(`annotationExport.error.${error}`)}
            onChange={(event) => {
              setFrom(event.target.value);
              if (error !== null) setError(validateExportDates(event.target.value, to));
            }}
          />
          <TextField
            id="annotation-export-to"
            name="date_to"
            type="date"
            autoComplete="off"
            label={t("annotationExport.form.to")}
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              if (error !== null) setError(validateExportDates(from, event.target.value));
            }}
          />
          {canPickAuthor ? (
            <FilterLookup filter={AUTHOR_FILTER} value={author} onChange={setAuthor} />
          ) : (
            <p className="m-0 text-sm text-ink-2">{t("annotationExport.form.authorUnavailable")}</p>
          )}
          <ExportChoice
            legend={t("annotationExport.form.format")}
            value={format}
            options={FORMATS.map((value) => ({
              value,
              label: t(`annotationExport.format.${value}`),
            }))}
            onChange={setFormat}
          />
        </div>
        <Switch
          label={t("annotationExport.form.includeVoided")}
          isOn={includeVoided}
          onChange={setIncludeVoided}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" loading={command.status === "pending"}>
            {t("annotationExport.form.submit")}
          </Button>
          <span role="status" className="text-sm text-ink-2">
            {command.status === "queued" ? t("annotationExport.form.queued") : null}
          </span>
        </div>
        {(command.status === "failed" || command.status === "tooMany") && (
          <InlineNotice tone="critical">
            {t(
              command.status === "tooMany"
                ? "annotationExport.error.tooMany"
                : "annotationExport.error.failed",
            )}
          </InlineNotice>
        )}
      </form>
    </Card>
  );
}
