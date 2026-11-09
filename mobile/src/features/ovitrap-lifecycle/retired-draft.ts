import { physicalIdentityStateSql } from "./physical-identity-state.ts";
/** The M-08 archive and slot replacement use the same current-state predicate in one transaction. */
export const RETIRED_CAPTURE_DRAFT = `${physicalIdentityStateSql({ idSql: "json_extract(ovitrap_draft.draft,'$.ovitrapId')", pointIdSql: "json_extract(ovitrap_draft.draft,'$.point.id')" })}=1`;
