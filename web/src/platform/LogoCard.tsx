/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { unwrap } from "@wolbachia/api-client";
import { ImageUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { prepareLogo } from "../settings/organization/branding";
import { Button } from "../ui/Button";
import { DetailSection } from "../components/templates/DetailSection";
import { InlineNotice } from "../ui/InlineNotice";
import type { PlatformOrganizationDetail } from "./platform-queries";
import { usePlatformAction, usePlatformScope } from "./use-platform";

/** The validated PNG served by the platform endpoint, as an object URL. */
function useLogoPreview(slug: string, version: string, hasLogo: boolean): string | null {
  const { client } = usePlatformScope();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasLogo) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void client
      .GET("/api/v1/platform/organizations/{slug}/logo/", {
        params: { path: { slug } },
        parseAs: "blob",
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (data instanceof Blob && data.type === "image/png") {
          objectUrl = URL.createObjectURL(data);
          setUrl(objectUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, slug, version, hasLogo]);
  return hasLogo ? url : null;
}

export function LogoCard({
  organization,
  highlight,
}: {
  organization: PlatformOrganizationDetail;
  highlight: boolean;
}) {
  const { t } = useTranslation();
  const { client } = usePlatformScope();
  const input = useRef<HTMLInputElement>(null);
  const [isInvalid, setIsInvalid] = useState(false);
  const version =
    organization.history.find((entry) => entry.action === "organization.logo_upload")?.created_at ??
    "";
  const preview = useLogoPreview(organization.slug, version, organization.has_logo);
  const upload = usePlatformAction({
    successKey: "platform.toast.logoUploaded",
    run: async (file: File, signal) =>
      unwrap(
        await client.POST("/api/v1/platform/organizations/{slug}/logo/", {
          params: { path: { slug: organization.slug } },
          body: { logo: file.name },
          bodySerializer: () => {
            const form = new FormData();
            form.set("logo", file);
            return form;
          },
          signal,
        }),
      ),
  });
  useEffect(() => {
    if (highlight) input.current?.closest("section")?.scrollIntoView({ block: "center" });
  }, [highlight]);
  const label = organization.has_logo
    ? t("platform.action.changeLogo")
    : t("platform.action.uploadLogo");
  return (
    <DetailSection
      title={t("platform.detail.logo")}
      actions={
        <Button
          size="sm"
          variant={highlight && !organization.has_logo ? "primary" : "secondary"}
          leadingIcon={<ImageUp aria-hidden="true" />}
          loading={upload.isBusy}
          onClick={() => input.current?.click()}
        >
          {label}
        </Button>
      }
    >
      <input
        ref={input}
        type="file"
        accept="image/png"
        className="sr-only"
        aria-label={t("platform.field.logo")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setIsInvalid(false);
          void prepareLogo(file)
            .then((png) => {
              upload.submit(png);
            })
            .catch(() => {
              setIsInvalid(true);
            });
        }}
      />
      <div className="flex flex-col gap-3">
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-muted p-3">
          {preview ? (
            <img
              src={preview}
              alt={t("platform.detail.logo")}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-center text-xs text-ink-3">{t("platform.detail.noLogo")}</span>
          )}
        </div>
        <p className="m-0 text-xs text-ink-3">{t("platform.logo.description")}</p>
        {(isInvalid || upload.hasFailed) && (
          <InlineNotice tone="critical">{t("platform.logo.invalid")}</InlineNotice>
        )}
      </div>
    </DetailSection>
  );
}
