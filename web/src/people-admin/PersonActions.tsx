/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import { KeyRound, RotateCcw, UserCog, UserX } from "lucide-react";
import type { Schemas } from "@wolbachia/api-client";
import { ScopeDialog } from "../settings/organization/ScopeDialog";
import { useCan } from "../session/use-can";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { InlineNotice } from "../ui/InlineNotice";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";
import { usePersonActions } from "./use-person-actions";

/**
 * Administration actions of a person. No permission: hidden. Allowed but the person is
 * deactivated: disabled with the reason. The backend re-checks everything.
 */
export function PersonActions({ person }: { person: Schemas["Personnel"] }) {
  const { t } = useTranslation();
  const can = useCan();
  const actions = usePersonActions(person);
  const blocked = person.is_active ? undefined : t("users.action.blockedInactive");
  const { writer } = actions;
  return (
    <>
      {can("role.update") && (
        <Button
          variant="secondary"
          leadingIcon={<UserCog aria-hidden="true" />}
          disabled={!person.is_active || writer.isBusy}
          title={blocked}
          onClick={() => void actions.openScope()}
        >
          {t("users.action.changeScope")}
        </Button>
      )}
      {can("user.update") && (
        <Button
          variant="secondary"
          leadingIcon={<KeyRound aria-hidden="true" />}
          disabled={!person.is_active}
          title={blocked}
          onClick={() => {
            actions.setPasswordOpen(true);
          }}
        >
          {t("users.password.action")}
        </Button>
      )}
      {can("role.update") && !person.is_active && (
        <Button
          leadingIcon={<RotateCcw aria-hidden="true" />}
          loading={writer.isBusy}
          onClick={() => void actions.reactivate()}
        >
          {t("users.action.reactivate")}
        </Button>
      )}
      {can("user.deactivate") && person.is_active && (
        <ConfirmDialog
          trigger={
            <Button variant="destructive" leadingIcon={<UserX aria-hidden="true" />}>
              {t("users.action.deactivate")}
            </Button>
          }
          title={t("users.deactivate.title", { name: person.display_name })}
          consequence={t("users.deactivate.consequence")}
          actionLabel={t("users.deactivate.confirm")}
          onConfirm={() => void actions.deactivate()}
        />
      )}
      {writer.error && (
        <div className="basis-full" role="alert">
          <InlineNotice tone="critical">{t(writer.error)}</InlineNotice>
        </div>
      )}
      {actions.membership && (
        <ScopeDialog
          target={{ kind: "membership", record: actions.membership }}
          codes={[]}
          onClose={actions.closeScope}
          onSaved={() => void actions.scopeSaved()}
        />
      )}
      {actions.isPasswordOpen && (
        <TemporaryPasswordDialog
          userId={person.id}
          name={person.display_name}
          onClose={() => {
            actions.setPasswordOpen(false);
          }}
        />
      )}
    </>
  );
}
