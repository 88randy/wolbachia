import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../ui/toast-context";
import { errorFieldOf, errorKeyOf } from "./centers-api";
import type { CenterRow } from "./centers-api";
import { useCentersScope } from "./use-centers-scope";

export interface CenterFormState {
  name: string;
  code: string;
  setName: (value: string) => void;
  setCode: (value: string) => void;
  nameError: string | undefined;
  codeError: string | undefined;
  isPending: boolean;
  submit: () => void;
}

/** Create, or rename (the code never changes); on success every center query refreshes. */
function useSaveCenter(center: CenterRow | undefined, onDone: () => void) {
  const { t } = useTranslation();
  const scope = useCentersScope();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: async (values: { name: string; code: string }) => {
      if (!center) return unwrap(await scope.client.POST("/api/v1/centers/", { body: values }));
      return unwrap(
        await scope.client.PATCH("/api/v1/centers/{id}/", {
          params: { path: { id: center.id } },
          body: { name: values.name },
        }),
      );
    },
    onSuccess: () => {
      // The shell center switcher and every center picker read "centers" queries.
      void queryClient.invalidateQueries();
      const message = center ? "centersAdmin.form.saved" : "centersAdmin.form.created";
      showToast({ message: t(message), tone: "success" });
      onDone();
    },
  });
}

/** Name and code of a new center, or the name of an existing one. */
export function useCenterForm(center: CenterRow | undefined, onDone: () => void): CenterFormState {
  const { t } = useTranslation();
  const [name, setName] = useState(center?.name ?? "");
  const [code, setCode] = useState(center?.code ?? "");
  const save = useSaveCenter(center, onDone);
  const error = save.error ?? undefined;
  const message = error ? t(errorKeyOf(error)) : undefined;
  const isCodeError = errorFieldOf(error) === "code";
  return {
    name,
    code,
    setName,
    setCode: (value) => {
      setCode(value.toUpperCase());
    },
    nameError: isCodeError ? undefined : message,
    codeError: isCodeError ? message : undefined,
    isPending: save.isPending,
    submit: () => {
      save.mutate({ name: name.trim(), code: code.trim() });
    },
  };
}
