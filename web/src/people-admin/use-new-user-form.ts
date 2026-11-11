/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useMe } from "../session/use-me";

export interface NewUserValues {
  displayName: string;
  username: string;
  email: string;
  centerId: string;
  profileId: string;
  scopeMode: "all" | "selected";
  /** Centers the admin picked by hand; until then the scope follows the chosen center. */
  pickedCenters: string[] | null;
}

const EMPTY: NewUserValues = {
  displayName: "",
  username: "",
  email: "",
  centerId: "",
  profileId: "",
  scopeMode: "selected",
  pickedCenters: null,
};

/** A new person can never get more than the administrator can grant (quadrants mirror the admin). */
export function useNewUserForm() {
  const me = useMe();
  const [values, setValues] = useState<NewUserValues>(EMPTY);
  const canGrantAllCenters = me.scope.centers.mode === "all";
  const centerIds = values.pickedCenters ?? (values.centerId ? [values.centerId] : []);
  function change(patch: Partial<NewUserValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }
  function toggleCenter(id: string) {
    change({
      pickedCenters: centerIds.includes(id)
        ? centerIds.filter((value) => value !== id)
        : [...centerIds, id],
    });
  }
  const scope: Schemas["MeScope"] = {
    centers:
      values.scopeMode === "all" ? { mode: "all", ids: [] } : { mode: "selected", ids: centerIds },
    quadrants: me.scope.quadrants,
  };
  const isComplete =
    values.displayName.trim() !== "" &&
    values.username.trim() !== "" &&
    values.centerId !== "" &&
    values.profileId !== "";
  const hasScope = values.scopeMode === "all" || centerIds.length > 0;
  return {
    values,
    change,
    toggleCenter,
    centerIds,
    scope,
    isComplete,
    hasScope,
    canGrantAllCenters,
  };
}

export type NewUserForm = ReturnType<typeof useNewUserForm>;
