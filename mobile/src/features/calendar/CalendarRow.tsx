import { View } from "react-native";
import type { AssignedTask } from "../day/types.ts";
import { CalendarItemRow } from "./CalendarItemRow.tsx";
import { CalendarTaskRow } from "./CalendarTaskRow.tsx";
import type { CalendarItem } from "./domain.ts";

interface CalendarRowProps {
  readonly item: CalendarItem;
  readonly time: string | null;
  /** Only today's tasks open (P9 flow); null keeps the row read-only. */
  readonly onStart: ((task: AssignedTask) => void) | null;
  readonly onOpenInbox: () => void;
}

/** One row of the selected day: a downloaded task or a fact the courier recorded. */
export function CalendarRow({ item, time, onStart, onOpenInbox }: CalendarRowProps) {
  const { task } = item;
  return (
    <View className="px-3">
      {task ? (
        <CalendarTaskRow
          item={{ ...item, task }}
          onStart={
            onStart
              ? () => {
                  onStart(task);
                }
              : null
          }
        />
      ) : (
        <CalendarItemRow item={item} time={time} onOpenInbox={onOpenInbox} />
      )}
    </View>
  );
}
