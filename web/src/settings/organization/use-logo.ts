import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionGuard } from "../../session/use-session-guard";
import { isSafeLogoUrl } from "./branding";
import { readLogo, reportLogoFailure } from "./read-logo";
/** Initials remain visible if the raster is missing, malformed, blocked or inaccessible. */
export function useLogo(url: string | null, revision: number): string | null {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  const [image, setImage] = useState<{
    revision: number;
    url: string | null;
    source: string;
  } | null>(null);
  useEffect(() => {
    if (!isSafeLogoUrl(url)) return;
    const guard = begin();
    const reader = new FileReader();
    let isCurrent = true;
    reader.onload = () => {
      if (!guard.isStale() && isCurrent && typeof reader.result === "string")
        setImage({ revision, url, source: reader.result });
    };
    void readLogo({ client, guard, reader }).catch((error: unknown) => {
      reportLogoFailure({ error, guard, queryClient });
    });
    return () => {
      isCurrent = false;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [url, revision, client, begin, queryClient]);
  return image?.revision === revision && image.url === url ? image.source : null;
}
