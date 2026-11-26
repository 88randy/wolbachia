/* eslint-disable max-lines-per-function -- presentational JSX of the detail dialogs. */
import { ApiError, unwrap } from "@wolbachia/api-client";
import { Building, CirclePause, CirclePlay, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "../forms/TextField";
import { FormDialog } from "../regulatory/FormDialog";
import { useMe } from "../session/use-me";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { DialogFooter } from "../ui/DialogFooter";
import { InlineNotice } from "../ui/InlineNotice";
import { ChoiceCards } from "./ChoiceCards";
import { CredentialReveal } from "./CredentialReveal";
import type { PlatformOrganizationDetail } from "./platform-queries";
import { usePlatformAction, usePlatformScope } from "./use-platform";

interface OrganizationProps {
  organization: PlatformOrganizationDetail;
}

function fieldCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const first = Object.values(error.envelope?.fields ?? {})[0];
  return first?.[0]?.code;
}

/** Suspend (or reactivate) with a required reason; nothing is deleted. */
export function SuspendDialog({ organization }: OrganizationProps) {
  const { t } = useTranslation();
  const { client } = usePlatformScope();
  const minimum = useMe().limits.void_reason_min_length;
  const [reason, setReason] = useState("");
  const isSuspending = organization.is_active;
  const action = usePlatformAction({
    successKey: isSuspending ? "platform.toast.suspended" : "platform.toast.reactivated",
    run: async (text: string, signal) => {
      const path = { slug: organization.slug };
      const body = { reason: text };
      return unwrap(
        isSuspending
          ? await client.POST("/api/v1/platform/organizations/{slug}/suspend/", {
              params: { path },
              body,
              signal,
            })
          : await client.POST("/api/v1/platform/organizations/{slug}/reactivate/", {
              params: { path },
              body,
              signal,
            }),
      );
    },
  });
  return (
    <FormDialog
      trigger={
        <Button
          variant={isSuspending ? "secondary" : "primary"}
          leadingIcon={
            isSuspending ? <CirclePause aria-hidden="true" /> : <CirclePlay aria-hidden="true" />
          }
        >
          {t(isSuspending ? "platform.action.suspend" : "platform.action.reactivate")}
        </Button>
      }
      title={t(isSuspending ? "platform.suspend.title" : "platform.reactivate.title")}
      description={t(
        isSuspending ? "platform.suspend.consequence" : "platform.reactivate.consequence",
        {
          name: organization.name,
        },
      )}
      submitLabel={t(isSuspending ? "platform.action.suspend" : "platform.action.reactivate")}
      destructive={isSuspending}
      canSubmit={reason.trim().length >= minimum}
      isBusy={action.isBusy}
      hasFailed={action.hasFailed}
      onReset={() => {
        setReason("");
        action.reset();
      }}
      onSubmit={(close) => {
        action.submit(reason.trim(), close);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="platform-reason" className="text-xs font-semibold text-ink-2">
          {t("platform.field.reason")}
        </label>
        <Textarea
          id="platform-reason"
          value={reason}
          maxLength={1000}
          required
          aria-describedby="platform-reason-hint"
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        <p id="platform-reason-hint" className="m-0 text-xs text-ink-3">
          {t("platform.field.reasonHint", { min: minimum })}
        </p>
      </div>
    </FormDialog>
  );
}

export function AddCenterDialog({ organization }: OrganizationProps) {
  const { t } = useTranslation();
  const { client } = usePlatformScope();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const action = usePlatformAction({
    successKey: "platform.toast.centerAdded",
    run: async (body: { code: string; name: string }, signal) =>
      unwrap(
        await client.POST("/api/v1/platform/organizations/{slug}/centers/", {
          params: { path: { slug: organization.slug } },
          body,
          signal,
        }),
      ),
  });
  const isTaken = fieldCode(action.error) === "center_code_taken";
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="secondary" leadingIcon={<Building aria-hidden="true" />}>
          {t("platform.action.addCenter")}
        </Button>
      }
      title={t("platform.center.title")}
      description={t("platform.center.description")}
      submitLabel={t("platform.action.addCenter")}
      canSubmit={/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(code) && name.trim() !== ""}
      isBusy={action.isBusy}
      hasFailed={action.hasFailed && !isTaken}
      onReset={() => {
        setCode("");
        setName("");
        action.reset();
      }}
      onSubmit={(close) => {
        action.submit({ code: code.trim(), name: name.trim() }, close);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <TextField
          id="new-center-code"
          label={t("platform.field.centerCode")}
          value={code}
          maxLength={50}
          error={isTaken ? t("platform.centers.duplicate") : undefined}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
          }}
        />
        <TextField
          id="new-center-name"
          label={t("platform.field.centerName")}
          value={name}
          maxLength={200}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </div>
    </FormDialog>
  );
}

interface AdminForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  delivery: "password" | "invite";
}

const EMPTY_ADMIN: AdminForm = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  delivery: "password",
};

/** A new admin account; a temporary password is shown once inside the dialog. */
export function AddAdminDialog({ organization }: OrganizationProps) {
  const { t } = useTranslation();
  const { client } = usePlatformScope();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<AdminForm>(EMPTY_ADMIN);
  const [created, setCreated] = useState<{ username: string; password: string | null } | null>(
    null,
  );
  const action = usePlatformAction({
    successKey: "platform.toast.adminAdded",
    run: async (value: AdminForm, signal) =>
      unwrap(
        await client.POST("/api/v1/platform/organizations/{slug}/admins/", {
          params: { path: { slug: organization.slug } },
          body: {
            admin_first_name: value.firstName.trim(),
            admin_last_name: value.lastName.trim(),
            admin_username: value.username.trim(),
            admin_email: value.email.trim(),
            admin_delivery: value.delivery,
          },
          signal,
        }),
      ),
  });
  const reset = () => {
    setForm(EMPTY_ADMIN);
    setCreated(null);
    action.reset();
  };
  const set = (patch: Partial<AdminForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const isTaken = fieldCode(action.error) === "username_taken";
  const canSubmit =
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    /^[\w.@+-]{1,150}$/.test(form.username) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  return (
    <Dialog
      trigger={
        <Button size="sm" variant="secondary" leadingIcon={<UserPlus aria-hidden="true" />}>
          {t("platform.action.addAdmin")}
        </Button>
      }
      title={t("platform.admin.title")}
      description={t("platform.admin.description")}
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) reset();
      }}
    >
      {created ? (
        <div className="flex flex-col gap-4">
          <CredentialReveal username={created.username} temporaryPassword={created.password} />
          <DialogFooter>
            <Button
              onClick={() => {
                setIsOpen(false);
                reset();
              }}
            >
              {t("common.actions.finish")}
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit || action.isBusy) return;
            action.submit(form, (result) => {
              setCreated({ username: result.username, password: result.temporary_password });
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="add-admin-first"
              label={t("platform.field.firstName")}
              value={form.firstName}
              maxLength={150}
              autoComplete="off"
              onChange={(event) => {
                set({ firstName: event.target.value });
              }}
            />
            <TextField
              id="add-admin-last"
              label={t("platform.field.lastName")}
              value={form.lastName}
              maxLength={150}
              autoComplete="off"
              onChange={(event) => {
                set({ lastName: event.target.value });
              }}
            />
            <TextField
              id="add-admin-username"
              label={t("platform.field.username")}
              value={form.username}
              maxLength={150}
              autoComplete="off"
              autoCapitalize="none"
              error={isTaken ? t("platform.field.usernameTaken") : undefined}
              onChange={(event) => {
                set({ username: event.target.value.trim() });
              }}
            />
            <TextField
              id="add-admin-email"
              type="email"
              label={t("platform.field.email")}
              value={form.email}
              maxLength={254}
              autoComplete="off"
              onChange={(event) => {
                set({ email: event.target.value.trim() });
              }}
            />
          </div>
          <ChoiceCards
            name="add-admin-delivery"
            legend={t("platform.field.delivery")}
            value={form.delivery}
            options={[
              { value: "password", label: t("platform.field.deliveryPassword") },
              { value: "invite", label: t("platform.field.deliveryInvite") },
            ]}
            onChange={(delivery) => {
              set({ delivery });
            }}
          />
          {action.hasFailed && !isTaken && (
            <InlineNotice tone="critical">{t("platform.common.failed")}</InlineNotice>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setIsOpen(false);
                reset();
              }}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" loading={action.isBusy} aria-disabled={!canSubmit || undefined}>
              {t("platform.action.addAdmin")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
