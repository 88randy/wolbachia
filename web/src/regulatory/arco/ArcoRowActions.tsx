/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { unwrap } from "@wolbachia/api-client";
import { Play, UserCheck } from "lucide-react";
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
  return (
    <span className="flex flex-wrap items-center gap-1">
      {row.status === "received" && (
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Play aria-hidden="true" />}
          loading={start.isBusy}
          onClick={() => {
            start.submit({ status: "in_progress" });
          }}
        >
          {t("regulatory.arco.start")}
        </Button>
      )}
      {row.owner_id !== me.user.id && (
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<UserCheck aria-hidden="true" />}
          loading={take.isBusy}
          onClick={() => {
            take.submit({ owner_id: me.user.id });
          }}
        >
          {t("regulatory.arco.takeIt")}
        </Button>
      )}
      <ArcoResolveDialog row={row} />
    </span>
  );
}
