import { useQueryClient } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { TableState } from "../data-table/table-types";
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
  const lookup = async () => {
    const wanted = code.trim();
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

/** One input: a scanner or the keyboard types the code and Enter loads that bag. */
export function CountScanStrip(props: CountScanStripProps) {
  const { t } = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const scan = useScanLookup(props);
  useEffect(() => {
    if (props.focusFirst) input.current?.focus();
  }, [props.focusFirst]);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-ink-2">
        <ScanLine aria-hidden="true" className="size-5 text-action" />
        {t("lab.count.scanTitle")}
      </label>
      <ScanInput id={id} inputRef={input} scan={scan} />
      {scan.isMissing && (
        <p role="alert" className="m-0 text-sm text-critical-fg">
          {t("lab.count.scanNotFound")}
        </p>
      )}
    </div>
  );
}

function ScanInput(props: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  scan: ReturnType<typeof useScanLookup>;
}) {
  const { id, inputRef, scan } = props;
  return (
    <input
      id={id}
      ref={inputRef}
      value={scan.code}
      autoComplete="off"
      spellCheck={false}
      aria-invalid={scan.isMissing || undefined}
      className="min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-lg"
      onChange={(event) => {
        scan.change(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        void scan.lookup();
      }}
    />
  );
}
