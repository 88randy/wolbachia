import { Camera } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import type { Ref } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { TextField } from "../forms/TextField";
import type { ScanExpect } from "./scan-label";
import { useCameraAvailable } from "./use-camera-available";
import { useScanResolver } from "./use-scan-resolver";
import type { ScanOutcome } from "./use-scan-resolver";

/** The camera dialog and its decoder are fetched only when someone opens the camera. */
const CameraScanDialog = lazy(async () => {
  const module = await import("./CameraScanDialog");
  return { default: module.CameraScanDialog };
});

const KIND_KEYS: Record<string, MessageKey> = {
  lot: "scan.kind.lot",
  bag: "scan.kind.bag",
  location: "scan.kind.location",
  motorcycle: "scan.kind.motorcycle",
  paddle: "scan.kind.paddle",
  ovitrap: "scan.kind.ovitrap",
};

export interface ScanFieldProps {
  id: string;
  label: string;
  hint?: string;
  /** Already translated error text. */
  error?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  /**
   * A scanner or the keyboard finished a code (Enter), or the camera read one. Gets the exact
   * human code: printed labels (`wbf:1:<kind>:<code or id>`) are already turned into it.
   */
  onScan: (code: string) => void;
  /** The kind of record this field wants; a label of another kind is refused with a message. */
  expects?: ScanExpect;
  /** Pass GS1 supplier strings through untouched (receiving supplies reads them itself). */
  acceptsSupplier?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function problemText(
  outcome: Extract<ScanOutcome, { status: "wrongKind" | "missing" }>,
  expects: ScanExpect | undefined,
  t: TFunction,
): string {
  if (outcome.status === "missing") return t("scan.missing");
  const found = t(KIND_KEYS[outcome.found] ?? "scan.kind.other");
  return t("scan.wrongKind", {
    found,
    expected: t(KIND_KEYS[expects ?? "lot"] ?? "scan.kind.other"),
  });
}

/**
 * The one code input of the app. Type a code or use a USB or Bluetooth scanner (they "type" the
 * code and press Enter), or tap the camera button to read it with the device camera.
 */
export function ScanField({
  inputRef,
  onChange,
  onScan,
  expects,
  acceptsSupplier = false,
  readOnly = false,
  disabled = false,
  ...field
}: ScanFieldProps) {
  const { t } = useTranslation();
  const hasCamera = useCameraAvailable();
  const resolve = useScanResolver(expects, acceptsSupplier);
  const [isOpen, setIsOpen] = useState(false);
  const [lastRead, setLastRead] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const isLocked = readOnly || disabled;
  const submit = async (raw: string) => {
    setProblem(null);
    const outcome = await resolve(raw);
    if (outcome.status === "wrongKind" || outcome.status === "missing") {
      setProblem(problemText(outcome, expects, t));
      return;
    }
    const code = outcome.status === "ok" ? outcome.code : outcome.text;
    if (code !== raw.trim()) onChange(code);
    onScan(code);
  };
  const finish = (code: string) => {
    setIsOpen(false);
    setLastRead(code);
    onChange(code);
    void submit(code);
  };
  return (
    <>
      <TextField
        {...field}
        ref={inputRef}
        readOnly={readOnly}
        disabled={disabled}
        error={field.error ?? problem ?? undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        onChange={(event) => {
          setProblem(null);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void submit(field.value);
        }}
        trailing={
          hasCamera && !isLocked ? (
            <button
              type="button"
              aria-label={t("scan.camera.open")}
              title={t("scan.camera.open")}
              className="-mr-1 inline-flex size-9 flex-none cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink-2 hover:bg-surface-muted hover:text-ink"
              onClick={() => {
                setIsOpen(true);
              }}
            >
              <Camera aria-hidden="true" className="size-5" />
            </button>
          ) : undefined
        }
      />
      <p role="status" className="sr-only">
        {lastRead === "" ? "" : t("scan.camera.read", { code: lastRead })}
      </p>
      {isOpen && (
        <Suspense fallback={null}>
          <CameraScanDialog
            onCode={finish}
            onClose={() => {
              setIsOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
