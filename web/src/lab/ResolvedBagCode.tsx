import { useReceptionBagCode } from "./use-reception-reference";

export function ResolvedBagCode({ id }: { id: string }) {
  const query = useReceptionBagCode(id);
  return <span>{query.data?.code ?? id}</span>;
}
