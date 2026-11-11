import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { OverflowAction } from "../components/templates/OverflowMenu";
import type { Motorcycle } from "./fleet-query";

/** Row click and the "⋯" menu both open the motorcycle record, keeping the list address. */
export function useFleetRowMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const link = (row: Motorcycle) =>
    ({ to: "/fleet/motorcycles/$code", params: { code: row.code }, search }) as const;
  const menu = (row: Motorcycle): readonly OverflowAction[] => [
    {
      id: "open",
      label: t("fleet.row.open"),
      onSelect: () => {
        void navigate({ to: "/fleet/motorcycles/$code", params: { code: row.code }, search: true });
      },
    },
  ];
  return { link, menu };
}
