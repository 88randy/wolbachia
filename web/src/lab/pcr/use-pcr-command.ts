import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionGuard } from "../../session/use-session-guard";
import { uploadPermitDocument } from "../../releases/permit-document-upload";
import { useToast } from "../../ui/toast-context";
import { useLabScope } from "../use-lab-scope";
import { pcrErrorKey, saveBlob } from "./pcr-api";
import type { PcrDetail, PcrResultRow } from "./pcr-api";

export type PcrCommand =
  | { kind: "ready" | "receive" | "close"; occurred_at?: string | null }
  | {
      kind: "ship";
      occurred_at?: string | null;
      tracking_number: string;
      carrier: string;
      evidence_id?: string | null;
    }
  | { kind: "undo" | "void"; reason: string }
  | { kind: "void_result"; result_id: string; reason: string }
  | { kind: "report"; upload_id: string }
  | { kind: "results"; rows: PcrResultRow[] };

/** One mutation for every step of a batch; the answer is the fresh detail. */
export function usePcrCommand(batch: PcrDetail, onDone?: () => void) {
  const { t } = useTranslation();
  const scope = useLabScope();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState<string>();
  const mutation = useMutation({
    mutationFn: async (command: PcrCommand): Promise<PcrDetail> => {
      const path = { params: { path: { id: batch.id } } };
      const client = scope.client;
      switch (command.kind) {
        case "ready":
          return unwrap(await client.POST("/api/v1/pcr-batches/{id}/ready/", { ...path, body: {} }));
        case "receive":
          return unwrap(
            await client.POST("/api/v1/pcr-batches/{id}/receive/", {
              ...path,
              body: { occurred_at: command.occurred_at ?? null },
            }),
          );
        case "close":
          return unwrap(await client.POST("/api/v1/pcr-batches/{id}/close/", { ...path, body: {} }));
        case "ship": {
          const body = {
            occurred_at: command.occurred_at ?? null,
            tracking_number: command.tracking_number,
            carrier: command.carrier,
            evidence_id: command.evidence_id ?? null,
          };
          return unwrap(await client.POST("/api/v1/pcr-batches/{id}/ship/", { ...path, body }));
        }
        case "undo":
          return unwrap(
            await client.POST("/api/v1/pcr-batches/{id}/undo/", { ...path, body: { reason: command.reason } }),
          );
        case "void":
          return unwrap(
            await client.POST("/api/v1/pcr-batches/{id}/void/", { ...path, body: { reason: command.reason } }),
          );
        case "void_result":
          return unwrap(
            await client.POST("/api/v1/pcr-batches/{id}/results/{result_id}/void/", {
              params: { path: { id: batch.id, result_id: command.result_id } },
              body: { reason: command.reason },
            }),
          );
        case "report":
          return unwrap(
            await client.POST("/api/v1/pcr-batches/{id}/reports/", {
              ...path,
              body: { upload_id: command.upload_id },
            }),
          );
        case "results":
          return unwrap(
            await client.POST("/api/v1/pcr-batches/{id}/results/", { ...path, body: { rows: command.rows } }),
          );
      }
    },
    onSuccess: () => {
      setError(undefined);
      void queryClient.invalidateQueries();
      onDone?.();
    },
    onError: (caught) => {
      const message = t(pcrErrorKey(caught));
      setError(message);
      showToast({ message, tone: "critical" });
      void queryClient.invalidateQueries();
    },
  });
  return { run: mutation.mutate, runAsync: mutation.mutateAsync, isPending: mutation.isPending, error };
}

/** Upload a file through the existing private upload endpoints; returns the verified id. */
export function usePcrUpload() {
  const scope = useLabScope();
  const begin = useSessionGuard();
  const [isBusy, setBusy] = useState(false);
  const upload = async (file: File): Promise<string> => {
    const guard = begin();
    setBusy(true);
    try {
      return await uploadPermitDocument({
        client: scope.client,
        file,
        clientId: crypto.randomUUID(),
        signal: guard.signal,
      });
    } finally {
      setBusy(false);
    }
  };
  return { upload, isBusy };
}

type FilePath =
  | { kind: "report"; id: string; report_id: string }
  | { kind: "evidence"; id: string; event_id: string }
  | { kind: "template"; id: string };

export function usePcrDownload() {
  const scope = useLabScope();
  const { t } = useTranslation();
  const { showToast } = useToast();
  return async (target: FilePath, fileName: string) => {
    try {
      const client = scope.client;
      const result =
        target.kind === "report"
          ? await client.GET("/api/v1/pcr-batches/{id}/reports/{report_id}/file/", {
              params: { path: { id: target.id, report_id: target.report_id } },
              parseAs: "blob",
            })
          : target.kind === "evidence"
            ? await client.GET("/api/v1/pcr-batches/{id}/events/{event_id}/evidence/", {
                params: { path: { id: target.id, event_id: target.event_id } },
                parseAs: "blob",
              })
            : await client.GET("/api/v1/pcr-batches/{id}/results-template/", {
                params: { path: { id: target.id } },
                parseAs: "blob",
              });
      const blob: Blob = unwrap(result);
      saveBlob(blob, fileName);
    } catch {
      showToast({ message: t("pcr.error.generic"), tone: "critical" });
    }
  };
}
