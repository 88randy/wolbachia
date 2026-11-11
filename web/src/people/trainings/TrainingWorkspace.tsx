import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingList } from "./TrainingList";
import { TrainingCourse } from "./TrainingCourse";
import { PersonTrainings } from "./PersonTrainings";
import { TrainingRequirements } from "./TrainingRequirements";
import type { TrainingScope } from "./training-query";

const TABS = ["courses", "requirements", "people"] as const;
type TabId = (typeof TABS)[number];

function tabOf(search: Readonly<Record<string, unknown>>): TabId {
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
    <Tabs
      value={tabOf(search)}
      onValueChange={(tab) => {
        void navigate({ to: ".", search: (previous) => ({ ...previous, tab }) });
      }}
      className="gap-4"
    >
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {t(`trainings.tab.${tab}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="courses" className="flex flex-col gap-4">
        <TrainingList scope={scope} />
        {course && <TrainingCourse key={course} scope={scope} code={course} />}
      </TabsContent>
      <TabsContent value="requirements">
        <TrainingRequirements scope={scope} />
      </TabsContent>
      <TabsContent value="people">
        <PersonTrainings scope={scope} />
      </TabsContent>
    </Tabs>
  );
}
