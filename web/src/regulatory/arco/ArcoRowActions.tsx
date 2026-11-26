/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { unwrap } from "@wolbachia/api-client";
import { Ellipsis, Play, UserCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { Button } from "../../ui/Button";
import type { ArcoRow } from "../reg-queries";
import { useRegAction } from "../use-reg-action";
import { useRegScope } from "../use-reg-list";
import { ArcoResolveDialog } from "./ArcoResolveDialog";

type Patch = { status: "in_progress" } | { owner_id: string };

/** What can be done with an open request: start it, take it, or close it with an answer. */
export function ArcoRowActions({ row }: { row: ArcoRow }) {
  const { t } = useTranslation();
  const { client } = useRegScope();
  const me = useMe();
  const start = useRegAction({
    successKey: "regulatory.arco.started",
    run: async (patch: Patch, signal) =>
      unwrap(
        await client.PATCH("/api/v1/arco-requests/{id}/", {
          params: { path: { id: row.id } },
          body: patch,
          signal,
        }),
      ),
  });
  const take = useRegAction({
    successKey: "regulatory.arco.assigned",
    run: async (patch: Patch, signal) =>
      unwrap(
        await client.PATCH("/api/v1/arco-requests/{id}/", {
          params: { path: { id: row.id } },
          body: patch,
          signal,
        }),
      ),
  });
  if (row.status === "resolved" || row.status === "rejected") return null;
  const hasMenu = row.status === "received" || row.owner_id !== me.user.id;
  return (
    <span className="flex items-center justify-end gap-1">
      <ArcoResolveDialog row={row} />
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("common.actions.rowActions")}
              leadingIcon={<Ellipsis aria-hidden="true" />}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.status === "received" && (
              <DropdownMenuItem
                onSelect={() => {
                  start.submit({ status: "in_progress" });
                }}
              >
                <Play aria-hidden="true" />
                {t("regulatory.arco.start")}
              </DropdownMenuItem>
            )}
            {row.owner_id !== me.user.id && (
              <DropdownMenuItem
                onSelect={() => {
                  take.submit({ owner_id: me.user.id });
                }}
              >
                <UserCheck aria-hidden="true" />
                {t("regulatory.arco.takeIt")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}
