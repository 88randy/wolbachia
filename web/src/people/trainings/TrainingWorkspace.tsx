import { useSearch } from "@tanstack/react-router";
import { TrainingList } from "./TrainingList";
import { TrainingCourse } from "./TrainingCourse";
import { PersonTrainings } from "./PersonTrainings";
import { TrainingRequirements } from "./TrainingRequirements";
import type { TrainingScope } from "./training-query";
export function TrainingWorkspace({ scope }: { scope: TrainingScope }) {
  const search = useSearch({ strict: false });
  const course = "course" in search && typeof search.course === "string" ? search.course : "";
  return (
    <>
      <TrainingList scope={scope} />
      {course && <TrainingCourse key={course} scope={scope} code={course} />}
      <TrainingRequirements scope={scope} />
      <PersonTrainings scope={scope} />
    </>
  );
}
