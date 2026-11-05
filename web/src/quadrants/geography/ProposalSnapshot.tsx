import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { BlockCreateForm } from "./BlockCreateForm";
import type { GeographyScope } from "./use-w-15";
import { polygonText } from "./geometry";
interface Props {
  scope: GeographyScope;
  quadrant: string;
  proposals: Schemas["BlockSuggestion"][];
}
/** A reviewed proposal is a memory-only draft. Refetch subtraction cannot discard its accepted block/point workflow. */
export function ProposalSnapshot({ scope, quadrant, proposals }: Props) {
  const [snapshot] = useState(proposals);
  return (
    <>
      {snapshot.map((proposal) => {
        const key = JSON.stringify(proposal.geometry);
        return scope.canPublish ? (
          <BlockCreateForm key={key} {...{ scope, quadrant, proposal }} />
        ) : (
          <pre key={key}>
            {polygonText(proposal.geometry)}
            {"\n"}
            {proposal.points.map((point) => point.join(",")).join("\n")}
          </pre>
        );
      })}
    </>
  );
}
