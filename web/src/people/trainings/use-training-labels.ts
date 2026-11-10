import { useQuery } from "@tanstack/react-query";
import { trainingLookupsOptions } from "./training-lookups";
import { useTrainingScope } from "./use-training-scope";

const UNKNOWN = "—";

/** Names for the ids the API returns (people, course versions); an unknown id reads "—". */
export function useTrainingLabels() {
  const data = useQuery(trainingLookupsOptions(useTrainingScope())).data;
  return {
    person: (id: string) => data?.people.find((option) => option.value === id)?.label ?? UNKNOWN,
    version: (id: string) => data?.versionNames[id] ?? UNKNOWN,
  };
}
