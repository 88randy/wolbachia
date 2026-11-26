import { useTranslation } from "react-i18next";

interface PortalBrandProps {
  organizationName: string;
  logoUrl: string | null;
}

/** The organization's own logo when it has one; otherwise the AedesVision wordmark. */
export function PortalBrand({ organizationName, logoUrl }: PortalBrandProps) {
  const { t } = useTranslation();
  if (logoUrl !== null)
    return (
      <span className="flex items-center gap-3">
        <img src={logoUrl} alt="" className="h-11 w-auto max-w-40 object-contain" />
        <span className="text-lg font-bold tracking-tight text-navy">{organizationName}</span>
      </span>
    );
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-xl bg-action text-sm font-bold text-on-action"
      >
        AV
      </span>
      <span className="text-xl font-bold tracking-tight text-navy">{t("portal.brand")}</span>
    </span>
  );
}
