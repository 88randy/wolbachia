import type { DayService } from "./service.ts";
/** Publish verified local maps before attempting HTTP, including cold starts with a hung/offline transport. */
export async function refreshDay(
  day: Pick<DayService, "verifyMap" | "bundle">,
  publish: () => Promise<void>,
): Promise<void> {
  await day.verifyMap();
  await publish();
  await day.bundle.refresh();
  await day.verifyMap();
  await publish();
}
