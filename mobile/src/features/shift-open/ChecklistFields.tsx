import { ChecklistRow } from "./ChecklistRow.tsx";
import type { M04Model } from "./use-m-04.ts";
export function ChecklistFields({ model }: { readonly model: M04Model }) {
  const draft = model.state?.draft;
  if (!draft) return null;
  return (
    <>
      {model.state?.catalog?.items.map((item) => (
        <ChecklistRow
          key={item.code}
          item={item}
          check={draft.checks.find((check) => check.item === item.code)}
          onChange={(check) => {
            model.edit({
              checks: [...draft.checks.filter((current) => current.item !== check.item), check],
            });
          }}
        />
      ))}
    </>
  );
}
