import { Eye } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SideSheet } from "../src/ui/SideSheet";
import { Button } from "../src/ui/Button";
import type { PreviewRecord } from "./preview-table-data";
export function PreviewRowActions({ record }: { record: PreviewRecord }) {
  const { t } = useTranslation();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const isOpen = "record" in search && search.record === record.id;
  return (
    <SideSheet
      open={isOpen}
      onOpenChange={(open) => {
        void navigate({
          to: ".",
          search: (previous) => ({ ...previous, record: open ? record.id : undefined }),
        });
      }}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("refresh.preview.sheet")}
          leadingIcon={<Eye aria-hidden="true" strokeWidth={1.5} />}
        />
      }
      title={record.id}
      description={t("refresh.preview.dialogDescription")}
    >
      <p>{t("refresh.preview.details")}</p>
    </SideSheet>
  );
}
