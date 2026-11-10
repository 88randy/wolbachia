import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLogo } from "./use-logo";
interface Props {
  name: string;
  url: string | null;
  revision: number;
}
export function LogoMark({ name, url, revision }: Props) {
  const { t } = useTranslation();
  const source = useLogo(url, revision);
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase();
  return source && failed !== source ? (
    <img
      className="max-h-16 w-auto max-w-full object-contain"
      src={source}
      alt={t("orgAdmin.brand.logo")}
      onError={() => {
        setFailed(source);
      }}
    />
  ) : (
    <span
      className="text-2xl font-bold text-action-strong"
      aria-label={t("orgAdmin.brand.initials")}
    >
      {initials}
    </span>
  );
}
