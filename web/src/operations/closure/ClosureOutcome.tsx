import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { InlineNotice } from "../../ui/InlineNotice";
import type { ClosureResult } from "./use-closure-write";
import { ClosureReceipt } from "./ClosureReceipt";
export function ClosureOutcome({
  result,
  receipt,
}: {
  result: ClosureResult | null;
  receipt: Schemas["QuadrantClosure"] | null;
}) {
  const { t } = useTranslation();
  const saved = result?.kind === "saved" ? result.receipt : receipt;
  if (saved) return <ClosureReceipt receipt={saved} />;
  if (!result) return null;
  return (
    <div role="alert">
      <InlineNotice tone="warning">
        {t(result.kind === "conflict" ? "closure.write.conflict" : "closure.write.failure")}
      </InlineNotice>
    </div>
  );
}
