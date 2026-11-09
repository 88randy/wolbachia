import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { breadcrumbsOf } from "./breadcrumb-path";
type Entry = ReturnType<typeof breadcrumbsOf>[number];
export function BreadcrumbItem({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const label = entry.key ? t(entry.key) : entry.label;
  return (
    <li>
      {entry.isLinked && !entry.isCurrent ? (
        <Link to={entry.path} activeOptions={{ exact: true }}>
          {label}
        </Link>
      ) : (
        <span aria-current={entry.isCurrent ? "page" : undefined}>{label}</span>
      )}
    </li>
  );
}
