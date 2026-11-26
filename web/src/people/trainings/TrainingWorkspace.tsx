/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative tab layout. */
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FolderTabs } from "../../ui/FolderTabs";
import { TrainingList } from "./TrainingList";
import { TrainingCourse } from "./TrainingCourse";
import { PersonTrainings } from "./PersonTrainings";
import { TrainingRequirements } from "./TrainingRequirements";
import type { TrainingScope } from "./training-query";

const TABS = ["courses", "requirements", "people"] as const;

function tabOf(search: Readonly<Record<string, unknown>>): string {
  const wanted = search["tab"];
  const found = TABS.find((tab) => tab === wanted);
  if (found) return found;
  return typeof search["subject"] === "string" && search["subject"] !== "" ? "people" : "courses";
}

/** Courses, requirements by center and certifications by person, one tab each. */
export function TrainingWorkspace({ scope }: { scope: TrainingScope }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const course = "course" in search && typeof search.course === "string" ? search.course : "";
  return (
    <FolderTabs
      label={t("trainings.workspace.title")}
      value={tabOf(search)}
      onValueChange={(tab) => {
        void navigate({ to: ".", search: (previous) => ({ ...previous, tab }) });
      }}
      items={[
        {
          value: "courses",
          label: t("trainings.tab.courses"),
          content: (
            <div className="flex flex-col gap-4">
              <TrainingList scope={scope} />
              {course && <TrainingCourse key={course} scope={scope} code={course} />}
            </div>
          ),
        },
        {
          value: "requirements",
          label: t("trainings.tab.requirements"),
          content: <TrainingRequirements scope={scope} />,
        },
        {
          value: "people",
          label: t("trainings.tab.people"),
          content: <PersonTrainings scope={scope} />,
        },
      ]}
    />
  );
}
