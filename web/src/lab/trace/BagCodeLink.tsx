import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import { BagTraceDrawer } from "./BagTraceDrawer";

/**
 * A bag code that opens the bag's full origin. Without `reading.read` it is plain text: the
 * backend would refuse the origin anyway, so the control is not offered.
 */
export function BagCodeLink({ code }: { code: string }) {
  const { t } = useTranslation();
  const canRead = useCan()("reading.read");
  const [isOpen, setOpen] = useState(false);
  if (!canRead) return <span>{code}</span>;
  return (
    <>
      <button
        type="button"
        className="inline cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-action-strong underline-offset-2 hover:underline"
        aria-label={t("labTrace.openFor", { code })}
        onClick={() => {
          setOpen(true);
        }}
      >
        {code}
      </button>
      {isOpen && (
        <BagTraceDrawer
          code={code}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
