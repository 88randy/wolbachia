import { useTranslation } from "react-i18next";
import { PagerButton } from "./PagerButton";
import styles from "./data-table.module.css";
import { pagerPlanOf } from "./table-state";
import type { PagerMove } from "./table-state";
import type { Paging, TableController } from "./table-types";
import type { MessageKey } from "@wolbachia/i18n";

interface PagerProps {
  paging: Paging;
  controller: TableController;
  labelKey?: MessageKey;
}

function follow(move: PagerMove, controller: TableController): void {
  if (move.kind === "page") controller.goToPage(move.page);
  else controller.goToCursor(move.cursor);
}

/**
 * Previous and next. Page mode also says "Page X of Y"; cursor mode only knows whether there is
 * another page in each direction (the cursor is opaque and its links come from the API).
 */
export function Pager({ paging, controller, labelKey = "table.pager.label" }: PagerProps) {
  const { t } = useTranslation();
  const { previous, next, position } = pagerPlanOf(paging);
  if (previous === null && next === null) return null;
  return (
    <nav className={styles.pager} aria-label={t(labelKey)}>
      <PagerButton
        label={t("table.pager.previous")}
        isDisabled={previous === null}
        onPress={() => {
          if (previous !== null) follow(previous, controller);
        }}
      />
      {position !== null && (
        <span className={styles.position}>{t("table.pager.position", position)}</span>
      )}
      <PagerButton
        label={t("table.pager.next")}
        isDisabled={next === null}
        onPress={() => {
          if (next !== null) follow(next, controller);
        }}
      />
    </nav>
  );
}
