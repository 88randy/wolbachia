import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { useMe } from "../session/use-me";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { addDays, todayIn, weekStartOf } from "./week-dates";
import { DEFAULT_TIME_ZONE } from "../format/time-zone";

type Source = Schemas["SourceEnum"];

export interface PreviewRow {
  block_code: string;
  category: "low" | "medium" | "high";
  protocol: string;
}
export interface PreviewError {
  row?: number;
  code: string;
  block_code?: string;
}

/** The three steps of the weekly import: choose, upload and preview, apply. */
export function useRiskImport() {
  const client = useApiClient();
  const me = useMe();
  const queryClient = useQueryClient();
  const thisWeek = weekStartOf(
    todayIn(me.organization?.timezone ?? DEFAULT_TIME_ZONE),
    me.organization?.epi_week ?? "iso",
  );
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<Source>("official_import");
  const [week, setWeek] = useState(thisWeek);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Schemas["Import"] | null>(null);
  const [isApplied, setIsApplied] = useState(false);

  const send = useMutation({
    mutationFn: async (chosen: File) => {
      const upload = unwrap(
        await client.POST("/api/v1/risk-category-import-uploads/", {
          body: { file: chosen.name },
          bodySerializer: () => {
            const form = new FormData();
            form.set("file", chosen);
            return form;
          },
        }),
      );
      return unwrap(
        await client.POST("/api/v1/risk-category-imports/", {
          body: { upload_id: upload.upload_id, week, source },
        }),
      );
    },
    onSuccess: (result) => {
      setPreview(result);
      setStep(3);
    },
  });
  const apply = useMutation({
    mutationFn: async (target: Schemas["Import"]) =>
      unwrap(
        await client.POST("/api/v1/risk-category-imports/{id}/apply/", {
          params: { path: { id: target.id } },
          body: { expected_revision: target.revision },
        }),
      ),
    onSuccess: async () => {
      setIsApplied(true);
      await Promise.all(
        ["risk", "schedule"].map((resource) => invalidateOrgScoped(queryClient, resource)),
      );
    },
  });

  const rows = (Array.isArray(preview?.preview_rows) ? preview.preview_rows : []) as PreviewRow[];
  const errors = (Array.isArray(preview?.errors) ? preview.errors : []) as PreviewError[];
  return {
    step,
    setStep,
    source,
    setSource,
    week,
    setWeek,
    weekChoices: [addDays(thisWeek, -7), thisWeek, addDays(thisWeek, 7)],
    thisWeek,
    file,
    setFile,
    send,
    apply,
    preview,
    rows,
    errors,
    isApplied,
    reset: () => {
      setPreview(null);
      setStep(2);
      send.reset();
    },
  };
}

export type RiskImport = ReturnType<typeof useRiskImport>;
