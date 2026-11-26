import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function ButtonContent({
  loading,
  icon,
  children,
}: {
  loading: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <span
        className={cn(
          "inline-flex max-w-full min-w-0 items-center justify-center gap-2",
          loading && "opacity-0",
        )}
      >
        {icon}
        {children}
      </span>
      {loading && (
        <LoaderCircle
          aria-hidden="true"
          strokeWidth={1.75}
          className="absolute animate-spin motion-reduce:animate-none"
        />
      )}
    </>
  );
}
