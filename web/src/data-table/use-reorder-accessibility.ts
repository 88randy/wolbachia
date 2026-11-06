import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DragOverEvent } from "@dnd-kit/react";
import { Accessibility } from "@dnd-kit/dom";
import { isSortable } from "@dnd-kit/react/sortable";
/** Localize pickup, changing position, drop and cancellation without overriding library semantics. */
export function useReorderAccessibility() {
  const { t } = useTranslation();
  return useMemo(
    () =>
      Accessibility.configure({
        screenReaderInstructions: { draggable: t("refresh.reorder.instructions") },
        announcements: {
          dragstart: () => t("refresh.reorder.start"),
          dragover: ({ operation }: DragOverEvent) =>
            isSortable(operation.source)
              ? t("refresh.reorder.position", { count: operation.source.index + 1 })
              : t("refresh.reorder.move"),
          dragend: (event: { canceled: boolean }) =>
            t(event.canceled ? "refresh.reorder.cancel" : "refresh.reorder.end"),
        },
      }),
    [t],
  );
}
