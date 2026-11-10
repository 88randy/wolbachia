import { unwrap } from "@wolbachia/api-client";
import { PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { SampleRow } from "./lab-lists";
import { useLabAction } from "./use-lab-action";
import { useLabScope } from "./use-lab-scope";

export function ReceiveSampleButton({ sample }: { sample: SampleRow }) {
  const { t } = useTranslation();
  const scope = useLabScope();
  const action = useLabAction<null>({
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
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={action.isBusy}
      leadingIcon={<PackageCheck aria-hidden="true" />}
      onClick={() => {
        action.submit(null);
      }}
    >
      {t("lab.results.receive")}
    </Button>
  );
}
