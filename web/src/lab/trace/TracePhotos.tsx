import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useLabScope } from "../use-lab-scope";
import type { BagTrace } from "./trace-query";

type Photo = BagTrace["reading"]["photos"][number];

/** Each photo is fetched through the API (current authorization), shown as a thumbnail, opened full size in a new tab. */
function usePhotoUrl(photo: Photo) {
  const scope = useLabScope();
  const query = useQuery({
    ...orgScopedQueryOptions(scope.identity, {
      key: ["lab", "trace", "photo", photo.id],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/attachments/{id}/download/", {
            params: { path: { id: photo.id } },
            parseAs: "blob",
            signal,
          }),
        ),
    }),
    enabled: scope.identity.isSettled,
    staleTime: Infinity,
    retry: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const created = URL.createObjectURL(query.data);
    setUrl(created);
    return () => {
      URL.revokeObjectURL(created);
    };
  }, [query.data]);
  return { url, isLoading: query.isLoading, isError: query.isError };
}

function TracePhoto({ photo, number }: { photo: Photo; number: number }) {
  const { t } = useTranslation();
  const { url, isLoading, isError } = usePhotoUrl(photo);
  if (isError)
    return (
      <span className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-line p-1 text-center text-xs text-ink-2">
        <ImageOff aria-hidden="true" className="size-5" />
        {t("labTrace.photos.unavailable", { n: number })}
      </span>
    );
  if (isLoading || !url) return <Skeleton className="size-24 rounded-lg" />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={t("labTrace.photos.open", { n: number })}
      className="block size-24 overflow-hidden rounded-lg border border-line"
    >
      <img
        src={url}
        alt={t("labTrace.photos.alt", { n: number })}
        className="size-full object-cover"
      />
    </a>
  );
}

export function TracePhotos({ photos }: { photos: readonly Photo[] }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t("labTrace.photos.title")} className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold text-ink">{t("labTrace.photos.title")}</h3>
      {photos.length === 0 ? (
        <p className="m-0 text-xs text-ink-3">{t("labTrace.photos.none")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <TracePhoto photo={photo} number={index + 1} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
