import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { splitValues } from "./training-input";
import { trainingVersionsOptions } from "./training-query";
import { useTrainingScope } from "./use-training-scope";
import type { TrainingFieldProps } from "./use-training-field-control";

const FIRST_PAGE = 1;

/** The versions of the chosen course the requirement accepts, ticked instead of pasted. */
export function TrainingVersionsField(props: TrainingFieldProps) {
  const { t } = useTranslation();
  const { field, draft, setField, isLocked } = props;
  const course = draft["training"] ?? "";
  const query = useQuery({
    ...trainingVersionsOptions(useTrainingScope(), { id: course, page: FIRST_PAGE }),
    enabled: course !== "",
  });
  const selected = splitValues(draft[field.key] ?? "");
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-[13px] font-semibold text-ink">{t(field.label)}</legend>
      {course === "" && <p className="m-0 text-sm text-ink-2">{t("trainings.field.pickCourseFirst")}</p>}
      {(query.data?.results ?? []).map((version) => (
        <label key={version.id} className="flex items-center gap-2 text-sm text-ink">
          <Checkbox
            checked={selected.includes(version.id)}
            disabled={isLocked ?? false}
            onCheckedChange={(checked) => {
              const rest = selected.filter((id) => id !== version.id);
              setField(field.key, (checked === true ? [...rest, version.id] : rest).join(", "));
            }}
          />
          {t("trainings.field.versionOption", { version: version.version })}
        </label>
      ))}
    </fieldset>
  );
}
