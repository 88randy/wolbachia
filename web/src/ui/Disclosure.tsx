import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** A titled block the person opens and closes: the one disclosure of the app (never a native triangle). */
export function Disclosure(props: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={props.defaultOpen ?? false} className="group min-w-0">
      <CollapsibleTrigger className="inline-flex min-h-8 items-center gap-1.5 rounded-md text-left text-sm font-semibold text-ink hover:text-action-strong">
        <ChevronRight
          aria-hidden="true"
          className="size-4 flex-none transition-transform group-data-[state=open]:rotate-90"
        />
        {props.title}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-5.5">{props.children}</CollapsibleContent>
    </Collapsible>
  );
}
