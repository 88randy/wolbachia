import { ORGANIZATION_UPDATE } from "./permissions";
import { useMe } from "../../session/use-me";
import type { SyntheticEvent } from "react";
import { useOnline } from "./use-online";
import type { OrganizationFormController } from "./use-organization-form";
export function useOrganizationAvailability(controller: OrganizationFormController) {
  const canEdit = useMe().permissions.includes(ORGANIZATION_UPDATE);
  const isOnline = useOnline();
  const isBlocked = controller.writer.isBusy || controller.writer.needsReview || !isOnline;
  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (canEdit && !isBlocked) void controller.save();
  }
  return { canEdit, isOnline, isBlocked, submit };
}
export type OrganizationAvailability = ReturnType<typeof useOrganizationAvailability>;
