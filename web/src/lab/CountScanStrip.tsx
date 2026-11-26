import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TableState } from "../data-table/table-types";
import { ScanField } from "../scan/ScanField";
import { queueOptions } from "./lab-query";
import type { Candidate, LabScope } from "./lab-query";

interface CountScanStripProps {
  scope: LabScope;
  state: TableState;
  /** Focus this input first only when no bag is loaded yet. */
  focusFirst: boolean;
  onFound: (bag: Candidate) => void;
}

function useScanLookup({ scope, state, onFound }: CountScanStripProps) {
  const cache = useQueryClient();
  const [code, setCode] = useState("");
  const [isMissing, setMissing] = useState(false);
  const lookup = async (scanned: string) => {
    const wanted = scanned.trim();
    if (wanted === "") return;
    const next = { ...state, page: 1, filters: { ...state.filters, code: wanted } };
    const answer = await cache.query({ ...queueOptions(scope, next), staleTime: 0 });
    const bag = answer.results.find((row) => row.code === wanted) ?? answer.results[0];
    setMissing(!bag);
    if (!bag) return;
    setCode("");
    onFound(bag);
  };
  const change = (value: string) => {
    setMissing(false);
    setCode(value);
  };
  return { code, change, isMissing, lookup };
}

/** One input: a scanner, the camera or the keyboard gives the code and that bag loads. */
export function CountScanStrip(props: CountScanStripProps) {
  const { t } = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const scan = useScanLookup(props);
  useEffect(() => {
    if (props.focusFirst) input.current?.focus();
  }, [props.focusFirst]);
  return (
    <div className="flex max-w-lg flex-col gap-1.5">
      <ScanField
        id={id}
        expects="bag"
        inputRef={input}
        label={t("lab.count.scanTitle")}
        value={scan.code}
        aria-invalid={scan.isMissing || undefined}
        onChange={scan.change}
        onScan={(code) => void scan.lookup(code)}
      />
      {scan.isMissing && (
        <p role="alert" className="m-0 text-sm text-critical-fg">
          {t("lab.count.scanNotFound")}
        </p>
      )}
    </div>
  );
}
