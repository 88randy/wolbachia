import { currentRevision, isSessionKnown, subscribeToRevision } from "../session/session-revision";
import { useCatalogOptimistic } from "./use-catalog-optimistic";
import { useState, useSyncExternalStore } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { useToast } from "../ui/toast-context";
import { useSessionGuard } from "../session/use-session-guard";
type Availability = { id: string; isActive: boolean; version: number };
/** Optimistic state and notices share the identity- and catalog-scoped editor lifetime. */
export function useCatalogFeedback() {
  const revision = useSyncExternalStore(subscribeToRevision, currentRevision);
  const isCurrent = () => revision === currentRevision() && isSessionKnown();
  const toast = useToast();
  const begin = useSessionGuard();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [optimisticAvailability, setOptimisticAvailability] =
    useCatalogOptimistic<Availability>(revision);
  const [optimisticOrder, setOptimisticOrder] = useCatalogOptimistic<string[]>(revision);
  const [error, setError] = useState<MessageKey | null>(null);
  const [announcement, setAnnouncement] = useState("");
  return {
    revision,
    isCurrent,
    toast,
    begin,
    t,
    language,
    optimisticOrder,
    setOptimisticOrder,
    optimisticAvailability,
    setOptimisticAvailability,
    error,
    setError,
    announcement,
    setAnnouncement,
  };
}
