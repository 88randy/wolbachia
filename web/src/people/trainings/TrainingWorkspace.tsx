import { useSearch } from "@tanstack/react-router";
import { useMe } from "../../session/use-me";
import { TrainingList } from "./TrainingList";
import { TrainingCourse } from "./TrainingCourse";
import { TrainingCreate } from "./TrainingCreate";
import { PersonTrainings } from "./PersonTrainings";
import { TrainingRequirements } from "./TrainingRequirements";
import { canPublishTraining } from "./training-input";
import type { TrainingScope } from "./training-query";
export function TrainingWorkspace({ scope }: { scope: TrainingScope }) {
  const me = useMe();
  const search = useSearch({ strict: false });
  const course = "course" in search && typeof search.course === "string" ? search.course : "";
  return (
    <>
      {canPublishTraining(me) && <TrainingCreate scope={scope} />}
      <TrainingList scope={scope} />
      {course && <TrainingCourse key={course} scope={scope} code={course} />}
      <TrainingRequirements scope={scope} />
      <PersonTrainings scope={scope} />
    </>
  );
}
