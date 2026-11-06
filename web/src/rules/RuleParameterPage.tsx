import { useParams } from "@tanstack/react-router";
import { NotFoundState } from "../states/NotFoundState";
import { ParameterLoader } from "./ParameterLoader";
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
/** W62 keeps the same keyed draft boundary and organization-free human-code route. */
export function RuleParameterPage() {
  const { key } = useParams({ strict: false });
  if (key === undefined || !KEY_PATTERN.test(key)) return <NotFoundState />;
  return <ParameterLoader key={key} parameterKey={key} />;
}
