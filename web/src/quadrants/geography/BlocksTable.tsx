import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { PointCreateDialog } from "./PointCreateDialog";
import { BlockHistoryDialog } from "./BlockHistoryDialog";
import { useBlocksTable } from "./use-blocks-table";
import type { BlocksTableOptions } from "./use-blocks-table";
export function BlocksTable(options: BlocksTableOptions) {
  const { t } = useTranslation();
  const list = useBlocksTable(options);
  const { scope, controller } = options;
  const history = { scope, controller, onClose: list.closeHistory };
  return (
    <>
      <DataTable caption={t("geography.blocks.title")} {...list.table} />
      {list.block && (
        <PointCreateDialog scope={scope} block={list.block} onClose={list.closeCreate} />
      )}
      {list.history && <BlockHistoryDialog {...history} block={list.history} />}
    </>
  );
}
