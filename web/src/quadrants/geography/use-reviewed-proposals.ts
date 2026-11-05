import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { suggestionOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
/** Reviewed proposals are form drafts: subtraction or same-identity reauthentication never replaces them. */
export function useReviewedProposals(scope: GeographyScope, quadrant: string) {
  const query = useQuery(suggestionOptions(scope, quadrant));
  const [reviewed, setReviewed] = useState<Schemas["BlockSuggestion"][] | null>(null);
  useEffect(() => {
    if (reviewed === null && query.data) setReviewed(query.data);
  }, [reviewed, query.data]);
  return { query, proposals: reviewed ?? query.data };
}
