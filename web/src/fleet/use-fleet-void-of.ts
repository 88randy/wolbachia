import { useFormatDateTime } from "../format/use-format-date-time";
import { useVoidReasonLabel, voidInfoOf } from "../void";
import type { Motorcycle } from "./fleet-query";
import { useFleetAuthor } from "./use-fleet-author";

/** How a voided motorcycle row shows its reason, author and time. */
export function useFleetVoidOf() {
  const author = useFleetAuthor();
  const formatWhen = useFormatDateTime();
  const reasonLabel = useVoidReasonLabel();
  return (item: Motorcycle) => voidInfoOf(item, author, { formatWhen, reasonLabel });
}
