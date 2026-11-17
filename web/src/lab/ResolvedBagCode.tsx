import { useReceptionBagCode } from "./use-reception-reference";
import { BagCodeLink } from "./trace/BagCodeLink";

export function ResolvedBagCode({ id }: { id: string }) {
  const query = useReceptionBagCode(id);
  return query.data?.code ? <BagCodeLink code={query.data.code} /> : <span>—</span>;
}
