import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LabChoiceDialog } from "./LabChoiceDialog";
import type { RecountRow } from "./lab-lists";
import { useLabAction } from "./use-lab-action";
import { useLabScope } from "./use-lab-scope";

type Role = Schemas["LabIndependentRoleEnum"];
const ROLES: readonly Role[] = ["second", "third"];

function useClaim(recount: RecountRow) {
  const scope = useLabScope();
  return useLabAction<Role>({
    successKey: "lab.recounts.claimed",
    run: async (role, signal) =>
      unwrap(
        await scope.client.POST("/api/v1/recounts/{id}/claim/", {
          params: { path: { id: recount.id } },
          body: {
            command_id: crypto.randomUUID(),
            expected_revision: recount.expected_revision,
            role,
          },
          signal,
        }),
      ),
  });
}

/** The person who makes the second or third count takes the recount; the server checks independence. */
export function ClaimRecountDialog({ recount }: { recount: RecountRow }) {
  const { t } = useTranslation();
  const action = useClaim(recount);
  return (
    <LabChoiceDialog
      id={"role-" + recount.id}
      title={t("lab.recounts.claimTitle")}
      description={t("lab.recounts.claimHint")}
      triggerLabel={t("lab.recounts.claim")}
      icon={UserCheck}
      fieldLabel={t("lab.recounts.role")}
      submitLabel={t("lab.recounts.save")}
      options={ROLES.map((value) => ({ value, label: t(`lab.recounts.role.${value}`) }))}
      initial={recount.state === "awaiting_third" ? "third" : "second"}
      isBusy={action.isBusy}
      onSubmit={(value, close) => {
        action.submit(value as Role, close);
      }}
    />
  );
}
