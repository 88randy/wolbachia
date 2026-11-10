import { useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { isReadDenied } from "../../operations/read-access";
import { rubricsOptions } from "./evaluation-query";
import type { EvaluationScope } from "./evaluation-query";
/** URL code owns the read; an untrusted or denied response never becomes a selected rubric. */
export function useRubricLookup(scope: EvaluationScope) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const code = "rubric_code" in search ? String(search.rubric_code) : "";
  const [input, setInput] = useState(code);
  const options = rubricsOptions(scope, code);
  const query = useQuery({ ...options, enabled: options.enabled && !!code });
  const rubric =
    !query.isPlaceholderData && !isReadDenied(query.error) ? query.data?.results[0] : undefined;
  const choose = (next: string) => {
    setInput(next);
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, rubric_code: next, rubric_page: "1" }),
    });
  };
  return { code, input, setInput, query, rubric, choose };
}
export type RubricLookupModel = ReturnType<typeof useRubricLookup>;
