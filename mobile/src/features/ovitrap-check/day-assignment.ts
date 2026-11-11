import type { AuthController } from "../../auth/auth-controller.ts";
import type { CachedTask, DayCache } from "../day/types.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import { hasCoordinates } from "../day/assignment-parser.ts";
import { recordAssignmentOutcome, warnAssignmentNull } from "./assignment-diagnostics.ts";
import type { Assignment, Point } from "./types.ts";

interface Dependencies {
  readonly bundle: Pick<DayBundleService, "read">;
  readonly auth: Pick<AuthController, "getSnapshot">;
}
type Organization = NonNullable<
  NonNullable<ReturnType<Dependencies["auth"]["getSnapshot"]>["profile"]>["organization"]
>;

function tasksToPoints(tasks: readonly CachedTask[]) {
  const points = new Map<string, Point>();
  const placeIds = new Set<string>();
  const ovitraps = new Map<string, { id: string; point: Point }>();
  for (const { task } of tasks) {
    if (!hasCoordinates(task)) continue;
    const point = { id: task.point_id, code: task.point_code, lat: task.lat, lng: task.lng };
    points.set(point.id, point);
    if (task.action === "place") placeIds.add(point.id);
    if (task.ovitrap_id) ovitraps.set(task.ovitrap_id, { id: task.ovitrap_id, point });
  }
  return {
    points: [...points.values()],
    placePointIds: [...placeIds],
    ovitraps: [...ovitraps.values()],
  };
}

function assignmentOf(cache: DayCache, version: string, organization: Organization): Assignment {
  return {
    version,
    epiWeek: organization.epi_week,
    organization: { timezone: organization.timezone, epi_week: organization.epi_week },
    ...tasksToPoints(cache.tasks),
    bags: [],
    reuse: [],
  };
}

/**
 * The capture's assignment is the same set of tasks the route shows (the downloaded day bundle),
 * so a point on the route is always a point the courier can capture. Null while there is no day
 * or no organization on the phone: the capture then says so instead of listing nothing.
 */
export function createDayAssignments({ bundle, auth }: Dependencies) {
  return {
    async read(): Promise<Assignment | null> {
      const cache = await bundle.read();
      const organization = auth.getSnapshot().profile?.organization;
      if (cache.meta === null) warnAssignmentNull("no_bundle_meta");
      else if (!organization) warnAssignmentNull("no_org");
      else {
        recordAssignmentOutcome("built");
        return assignmentOf(cache, cache.meta.bundle_version, organization);
      }
      return null;
    },
  };
}
