import { CalendarService } from "./service.ts";

type Dependencies = Omit<ConstructorParameters<typeof CalendarService>[0], "now">;

export function createCalendar(deps: Dependencies): CalendarService {
  return new CalendarService({ ...deps, now: () => new Date() });
}
