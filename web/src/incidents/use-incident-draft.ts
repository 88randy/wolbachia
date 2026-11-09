import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useSessionIdentity } from "../session/use-session-identity";
function readDraft(key: string) {
 try { return sessionStorage.getItem(key) ?? ""; }
 catch { return ""; } // Storage denied: the form remains an in-memory draft.
}
function writeDraft(key: string, value: string) {
 try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); }
 catch { return; } // Storage denied: retain the current React draft.
}
/** Drafts survive the same actor's reauthentication; another user or organization gets another key. */
export function useIncidentDraft(kind: "comment" | "close" | "void") {
 const identity = useSessionIdentity();
 const { code } = useParams({ strict: false });
 const key = `wolbachia.incident-draft:${JSON.stringify([identity.userId, identity.organizationSlug, code, kind])}`;
 const [value, setValue] = useState(() => readDraft(key));
 const [isRestored, setRestored] = useState(Boolean(value));
 return { value, isRestored,
 setValue: (next: string) => { setValue(next); setRestored(false); writeDraft(key, next); },
 discard: () => { setValue(""); setRestored(false); writeDraft(key, ""); },
 };
}
