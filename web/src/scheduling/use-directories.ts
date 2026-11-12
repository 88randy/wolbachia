import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { couriersOptions, quadrantNamesOptions } from "./scheduling-queries";

/**
 * `nameOf(courierId)`: the courier name when the people directory is readable, else a numbered
 * label that stays stable while the list does not change ("Repartidor 2").
 */
export function useCouriers(knownIds: readonly string[]) {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const { t } = useTranslation();
  const directory = useQuery(couriersOptions(client, identity)).data;
  const key = knownIds.join("|");
  return useMemo(() => {
    const names = new Map((directory ?? []).map((person) => [person.id, person.display_name]));
    const ordered = [...new Set(key === "" ? [] : key.split("|"))].sort();
    ordered.forEach((id, index) => {
      if (!names.has(id)) names.set(id, t("scheduling.courier.numbered", { number: index + 1 }));
    });
    const nameOf = (id: string | null) =>
      id === null
        ? t("scheduling.courier.none")
        : (names.get(id) ?? t("scheduling.courier.unknown"));
    const couriers = (directory ?? [])
      .filter((person) => person.is_courier || ordered.includes(person.id))
      .map((person) => person.id);
    const unlisted = ordered.filter((id) => !couriers.includes(id));
    return { nameOf, ids: [...couriers, ...unlisted] };
  }, [directory, key, t]);
}

export function useCourierNames(knownIds: readonly string[]) {
  return useCouriers(knownIds).nameOf;
}

export function useQuadrantCodes() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const rows = useQuery(quadrantNamesOptions(client, identity)).data;
  return useMemo(() => {
    const codes = new Map((rows ?? []).map((row) => [row.id, row.code]));
    return (id: string) => codes.get(id) ?? "…";
  }, [rows]);
}
