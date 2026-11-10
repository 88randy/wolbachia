import { useState } from "react";
import { TrainingCommandDialog } from "./TrainingCommandDialog";
import { REQUIREMENT_FIELDS } from "./requirement-input";
import { publishRequirement } from "./requirement-command";
import type { PersonContext } from "./person-context";
import type { Requirement, TrainingScope } from "./training-query";
interface Props {
  scope: TrainingScope;
  context: PersonContext;
  requirement?: Requirement;
  isFresh: boolean;
}
export function RequirementPublish({ scope, context, requirement, isFresh }: Props) {
  const [revision, setRevision] = useState(requirement?.revision ?? 0);
  const fields = REQUIREMENT_FIELDS.map((field) =>
    requirement && field.key === "action" ? { ...field, isReadOnly: true } : field,
  );
  const actualContext = requirement
    ? { ...context, center: requirement.center_id, quadrant: requirement.quadrant_id ?? "" }
    : context;
  return (
    <TrainingCommandDialog
      scope={scope}
      title="trainings.requirement.publish"
      description="trainings.requirement.publishHint"
      fields={fields}
      initial={{ action: requirement?.action ?? "" }}
      isBlocked={!isFresh}
      onOpen={() => {
        setRevision(requirement?.revision ?? 0);
      }}
      execute={async (draft, signal) =>
        publishRequirement(scope, { draft, signal, context: actualContext, revision, requirement })
      }
    />
  );
}
