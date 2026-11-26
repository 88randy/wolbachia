import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { buttonVariants } from "../ui/button-variants";
import { EmptyState } from "../ui/EmptyState";
import { CountEditor } from "./CountEditor";
import type { Candidate } from "./lab-query";

type CountWorkspaceEditorProps = Omit<ComponentProps<typeof CountEditor>, "bag"> & {
  bag: Candidate | null;
};

/** No pending bags is not an error: one friendly message and the way to receive more. */
function NoBags() {
  const { t } = useTranslation();
  const canReceive = useCan()("bag.receive");
  return (
    <EmptyState
      kind="noData"
      message={`${t("lab.count.noBags")}. ${t("lab.count.noBagsHint")}`}
      action={
        canReceive && (
          <Link to="/lab/bags" className={buttonVariants({ variant: "primary" })}>
            {t("lab.count.receiveBags")}
          </Link>
        )
      }
    />
  );
}

export function CountWorkspaceEditor({ bag, ...editor }: CountWorkspaceEditorProps) {
  return bag ? <CountEditor {...editor} bag={bag} /> : <NoBags />;
}
