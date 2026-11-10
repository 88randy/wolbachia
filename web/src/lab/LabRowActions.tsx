import { unwrap } from "@wolbachia/api-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { ClaimRecountDialog } from "./ClaimRecountDialog";
import { LabRowMenu } from "./LabRowMenu";
import type { LabRowMenuItem } from "./LabRowMenu";
import { RecordResultDialog } from "./RecordResultDialog";
import type { RecountRow, SampleRow } from "./lab-lists";
import { useLabAction } from "./use-lab-action";
import { useLabScope } from "./use-lab-scope";

/** "⋯" menu of a recount row: take the recount when someone still has to count. */
export function RecountRowActions({ recount }: { recount: RecountRow }) {
  const { t } = useTranslation();
  const canClaim = useCan()("recount.create");
  const [open, setOpen] = useState(false);
  const isOpenForCount = recount.state === "awaiting_second" || recount.state === "awaiting_third";
  const items: LabRowMenuItem[] =
    canClaim && isOpenForCount
      ? [
          {
            label: t("lab.recounts.claim"),
            onSelect: () => {
              setOpen(true);
            },
          },
        ]
      : [];
  return (
    <>
      <LabRowMenu items={items} rowLabel={recount.bag_code} />
      <ClaimRecountDialog recount={recount} open={open} onOpenChange={setOpen} />
    </>
  );
}

function useReceive(sample: SampleRow) {
  const scope = useLabScope();
  return useLabAction<null>({
    successKey: "lab.results.received",
    run: async (_input, signal) =>
      unwrap(
        await scope.client.POST("/api/v1/wolbachia-samples/{id}/receive/", {
          params: { path: { id: sample.id } },
          body: { command_id: crypto.randomUUID() },
          signal,
        }),
      ),
  });
}

function useSampleItems(sample: SampleRow, openResult: () => void): LabRowMenuItem[] {
  const { t } = useTranslation();
  const can = useCan();
  const receive = useReceive(sample);
  if (sample.voided) return [];
  if (!sample.receipt)
    return can("sample.receive")
      ? [
          {
            label: t("lab.results.receive"),
            onSelect: () => {
              receive.submit(null);
            },
          },
        ]
      : [];
  const isOpen = sample.result_status === "missing" || sample.result_status === "invalid";
  if (!isOpen || !can("sample.result_create")) return [];
  const key = sample.result_status === "invalid" ? "lab.results.repeat" : "lab.results.record";
  return [{ label: t(key), onSelect: openResult }];
}

/** "⋯" menu of a sample row: receive it, then record or repeat its result. */
export function SampleRowActions({ sample }: { sample: SampleRow }) {
  const [open, setOpen] = useState(false);
  const items = useSampleItems(sample, () => {
    setOpen(true);
  });
  return (
    <>
      <LabRowMenu items={items} rowLabel={sample.code} />
      <RecordResultDialog sample={sample} open={open} onOpenChange={setOpen} />
    </>
  );
}
