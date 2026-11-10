import type { PickerOption } from "../../forms/OptionPicker";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { TRAINING_RESOURCE } from "./training-query";
import type { TrainingScope } from "./training-query";

const LOOKUP_PAGE_SIZE = 200;

export interface TrainingLookups {
  people: PickerOption[];
  centers: PickerOption[];
  quadrants: PickerOption[];
  courses: PickerOption[];
  /** Same courses, valued by their current version (what a certificate is issued against). */
  courseVersions: PickerOption[];
}

/** An unreadable list (no permission) is an empty picker, never a broken form. */
async function rows<Row>(
  call: Promise<{ response: Response; data?: { results: Row[] } }>,
): Promise<Row[]> {
  try {
    const answer = await call;
    return answer.response.ok ? (answer.data?.results ?? []) : [];
  } catch {
    return [];
  }
}

/** Names for the pickers of W50: people, centers, quadrants and courses. */
export function trainingLookupsOptions(scope: TrainingScope) {
  const { client } = scope;
  return orgScopedQueryOptions(scope.identity, {
    key: [TRAINING_RESOURCE, "lookups"],
    queryFn: async ({ signal }): Promise<TrainingLookups> => {
      const page = { page_size: LOOKUP_PAGE_SIZE };
      const [people, centers, quadrants, courses] = await Promise.all([
        rows(
          client.GET("/api/v1/users/operational/", {
            params: { query: { ...page, is_active: true } },
            signal,
          }),
        ),
        rows(client.GET("/api/v1/centers/", { params: { query: page }, signal })),
        rows(client.GET("/api/v1/quadrants/", { params: { query: page }, signal })),
        rows(client.GET("/api/v1/trainings/", { params: { query: page }, signal })),
      ]);
      return {
        people: people.map((row) => ({
          value: row.id,
          label: row.display_name,
          hint: row.profiles.join(", "),
        })),
        centers: centers.map((row) => ({ value: row.id, label: row.name, hint: row.code })),
        quadrants: quadrants.map((row) => ({ value: row.id, label: row.code })),
        courses: courses.map((row) => ({ value: row.id, label: row.name, hint: row.code })),
        courseVersions: courses.flatMap((row) =>
          row.current_version_id === null
            ? []
            : [{ value: row.current_version_id, label: row.name, hint: row.code }],
        ),
      };
    },
  });
}
