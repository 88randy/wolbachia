/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { DataTableColumn } from "../data-table/table-types";
import { StatusPill } from "../ui/StatusPill";
import type { Person } from "./users-query";
import type { PeopleLookups } from "./use-people-lookups";

/** W48 columns: name (opens W49), profiles, center, masked RFC and status. */
export function useUserColumns(lookups: PeopleLookups): readonly DataTableColumn<Person>[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        id: "display_name",
        headerKey: "users.column.name",
        cell: (person) => (
          <Link
            to="/settings/users/$id"
            params={{ id: person.id }}
            className="font-semibold text-action hover:underline"
          >
            {person.display_name}
          </Link>
        ),
      },
      {
        id: "profiles",
        headerKey: "users.column.profiles",
        cell: (person) => lookups.profilesOf(person.membership_id) || "—",
      },
      {
        id: "center",
        headerKey: "users.column.center",
        cell: (person) => lookups.centerName(person.center_id),
      },
      {
        id: "rfc",
        headerKey: "users.column.rfc",
        cell: (person) =>
          person.has_rfc ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-ink-2">
              <Lock aria-hidden="true" className="size-3.5 text-warning-fg" />
              <span aria-label={t("users.rfc.hidden")}>{t("users.rfc.mask")}</span>
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "status",
        headerKey: "users.column.status",
        cell: (person) => (
          <StatusPill tone={person.is_active ? "success" : "neutral"}>
            {t(person.is_active ? "users.status.active" : "users.status.inactive")}
          </StatusPill>
        ),
      },
    ],
    [t, lookups],
  );
}
