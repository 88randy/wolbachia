/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): one logo card. */
import { useTranslation } from "react-i18next";
import { ImageUp, Upload } from "lucide-react";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { useLogoFile } from "./use-logo-file";
import type { OrganizationFormController } from "./use-organization-form";
import { LogoMark } from "./LogoMark";
interface Props {
  controller: OrganizationFormController;
  canEdit: boolean;
  isBlocked: boolean;
}
/** The organization logo: the shell and new labels show it; without one, the wordmark. */
export function LogoUpload({ controller, canEdit, isBlocked }: Props) {
  const { t } = useTranslation();
  const selection = useLogoFile();
  const { settings } = controller;
  return (
    <Card title={t("orgAdmin.brand.logo")}>
      <div className="flex flex-col gap-4">
        <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-muted p-4">
          <LogoMark name={settings.name} url={settings.logo_url} revision={settings.revision} />
        </div>
        {canEdit && (
          <>
            <label
              htmlFor="organization-logo"
              className="inline-flex min-h-10 w-max max-w-full cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-tint has-disabled:cursor-default has-disabled:opacity-60"
            >
              <ImageUp aria-hidden="true" className="size-4 flex-none" />
              <span className="truncate">
                {selection.file ? selection.file.name : t("orgAdmin.brand.choose")}
              </span>
              <input
                id="organization-logo"
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/webp"
                disabled={isBlocked}
                onChange={selection.choose}
              />
            </label>
            <p className="m-0 text-xs text-ink-2">{t("orgAdmin.brand.formats")}</p>
            {selection.isInvalid && (
              <InlineNotice tone="critical">
                <p role="alert">{t("orgAdmin.brand.invalid")}</p>
              </InlineNotice>
            )}
            <Button
              leadingIcon={<Upload aria-hidden="true" />}
              disabled={isBlocked || !selection.file}
              onClick={() => {
                if (selection.file) void controller.upload(selection.file);
              }}
            >
              {t("orgAdmin.brand.upload")}
            </Button>
            <p role="status" className="m-0 text-sm font-semibold text-success-fg">
              {controller.isLogoSaved ? t("orgAdmin.brand.saved") : ""}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
