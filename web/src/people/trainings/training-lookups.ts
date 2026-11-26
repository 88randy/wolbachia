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
  /** Every course version id to its readable name: course and version number. */
  versionNames: Readonly<Record<string, string>>;
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
      const versions = await Promise.all(
        courses.map(async (course) => {
          const list = await rows(
            client.GET("/api/v1/trainings/{id}/versions/", {
              params: { path: { id: course.id }, query: { page_size: LOOKUP_PAGE_SIZE } },
              signal,
            }),
          );
          return list.map(
            (item) => [item.id, `${course.name} · v${String(item.version)}`] as const,
          );
        }),
      );
      return {
        versionNames: Object.fromEntries(versions.flat()),
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

/** The lookup lists that hold picker options (not the id-to-name map). */
export type ListName = Exclude<keyof TrainingLookups, "versionNames">;
