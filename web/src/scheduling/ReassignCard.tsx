import { Info, Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { InlineNotice } from "../ui/InlineNotice";
import { SelectMenu } from "../ui/SelectMenu";
import { useCan } from "../session/use-can";
import { useReassignPending } from "./use-scheduling-writes";

type Task = Schemas["Task"];

/** Moves the points a courier did not finish to another courier, showing the new load first. */
export function ReassignCard({
  pending,
  fromName,
  revision,
  target,
  options,
}: {
  pending: readonly Task[];
  fromName: string;
  revision: number;
  target: number;
  /** Other couriers with their load of the same day. */
  options: readonly { id: string; name: string; load: number }[];
}) {
  const { t } = useTranslation();
  const can = useCan();
  const [chosen, setChosen] = useState("");
  const reassign = useReassignPending(() => {
    setChosen("");
  });
  const picked = options.find((option) => option.id === chosen);
  const after = (picked?.load ?? 0) + pending.length;
  const isOver = picked !== undefined && target > 0 && after > target;
  const canManage = can("schedule.manage");
  return (
    <Card title={t("scheduling.reassign.title", { count: pending.length, name: fromName })}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reassign-to" className="text-[13px] font-semibold text-ink">
            {t("scheduling.reassign.to")}
          </label>
          <SelectMenu
            id="reassign-to"
            value={chosen}
            onValueChange={setChosen}
            placeholder={t("scheduling.reassign.choose")}
            options={options.map((option) => ({
              value: option.id,
              label: t("scheduling.reassign.option", { name: option.name, load: option.load }),
            }))}
          />
        </div>
        {picked && (
          <InlineNotice tone={isOver ? "warning" : "info"}>
            <p>
              {t(isOver ? "scheduling.reassign.over" : "scheduling.reassign.fits", {
                name: picked.name,
                total: after,
                target,
              })}
            </p>
          </InlineNotice>
        )}
        {!canManage && (
          <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
            <Info aria-hidden="true" className="size-4" />
            {t("scheduling.reassign.blocked")}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            leadingIcon={<Send aria-hidden="true" />}
            loading={reassign.isPending}
            disabled={!canManage || chosen === ""}
            onClick={() => {
              reassign.mutate({
                expected_revision: revision,
                task_ids: pending.map((task) => task.id),
                courier: chosen,
              });
            }}
          >
            {t("scheduling.reassign.apply")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
