import { useState } from "react";
import { useTranslation } from "react-i18next";
import { todayIn, zonedLocalToIso } from "../../format/time-zone";
import { useOrganizationTimeZone } from "../../format/use-time-zone";
import { TextField } from "../../forms/TextField";
import { DateField } from "../../ui/DateField";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { DialogFooter } from "../../ui/DialogFooter";
import { InlineNotice } from "../../ui/InlineNotice";
import type { PcrDetail } from "./pcr-api";
import { usePcrCommand, usePcrUpload } from "./use-pcr-command";

const EVIDENCE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

/** A picked date at noon in the organization's zone (never the future): what the staff wrote. */
function dateToInstant(value: string, timeZone: string): string | null {
  const picked = value ? zonedLocalToIso(`${value}T12:00`, timeZone) : null;
  if (picked === null) return null;
  return Date.parse(picked) > Date.now() ? new Date().toISOString() : picked;
}

interface ControlledProps {
  batch: PcrDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Registrar envío": date, carrier, tracking number and an optional receipt (photo or PDF). */
export function ShipDialog({ batch, open, onOpenChange }: ControlledProps) {
  const { t } = useTranslation();
  const timeZone = useOrganizationTimeZone();
  const command = usePcrCommand(batch, () => {
    onOpenChange(false);
  });
  const files = usePcrUpload();
  const [date, setDate] = useState(() => todayIn(timeZone));
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const submit = async () => {
    if (!tracking.trim()) return;
    let evidence: string | null = null;
    if (file) {
      try {
        evidence = await files.upload(file);
      } catch {
        setFileError(t("pcr.error.pcr_file_not_ready"));
        return;
      }
    }
    command.run({
      kind: "ship",
      occurred_at: dateToInstant(date, timeZone),
      tracking_number: tracking.trim(),
      carrier: carrier.trim(),
      evidence_id: evidence,
    });
  };
  return (
    <Dialog
      trigger={<span hidden />}
      title={t("pcr.ship.title")}
      description={t("pcr.ship.description")}
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            id="pcr-ship-date"
            label={t("pcr.ship.date")}
            value={date}
            max={todayIn(timeZone)}
            onChange={setDate}
          />
          <TextField
            id="pcr-ship-tracking"
            label={t("pcr.ship.tracking")}
            value={tracking}
            maxLength={100}
            required
            onChange={(event) => {
              setTracking(event.currentTarget.value);
            }}
          />
        </div>
        <TextField
          id="pcr-ship-carrier"
          label={t("pcr.ship.carrier")}
          value={carrier}
          maxLength={200}
          onChange={(event) => {
            setCarrier(event.currentTarget.value);
          }}
        />
        <FilePicker
          id="pcr-ship-evidence"
          label={t("pcr.ship.evidence")}
          accept={EVIDENCE_TYPES}
          typeError={t("pcr.file.type")}
          file={file}
          error={fileError}
          onChange={(next, problem) => {
            setFile(next);
            setFileError(problem);
          }}
        />
        {command.error && <InlineNotice tone="critical">{command.error}</InlineNotice>}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={command.isPending || files.isBusy}>
            {t("pcr.ship.submit")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** "Marcar recibida": the date the external laboratory got the samples. */
export function ReceiveDialog({ batch, open, onOpenChange }: ControlledProps) {
  const { t } = useTranslation();
  const timeZone = useOrganizationTimeZone();
  const command = usePcrCommand(batch, () => {
    onOpenChange(false);
  });
  const [date, setDate] = useState(() => todayIn(timeZone));
  return (
    <Dialog
      trigger={<span hidden />}
      title={t("pcr.receive.title")}
      description={t("pcr.receive.description")}
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          command.run({ kind: "receive", occurred_at: dateToInstant(date, timeZone) });
        }}
      >
        <div className="max-w-60">
          <DateField
            id="pcr-receive-date"
            label={t("pcr.receive.date")}
            value={date}
            max={todayIn(timeZone)}
            onChange={setDate}
          />
        </div>
        {command.error && <InlineNotice tone="critical">{command.error}</InlineNotice>}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={command.isPending}>
            {t("pcr.action.receive")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

interface ReasonDialogProps extends ControlledProps {
  mode: "undo" | "void" | { resultId: string };
}

/** Undo the last step, void the batch or void one result: always with a reason. */
export function ReasonDialog({ batch, open, onOpenChange, mode }: ReasonDialogProps) {
  const { t } = useTranslation();
  const command = usePcrCommand(batch, () => {
    onOpenChange(false);
  });
  const [reason, setReason] = useState("");
  const kind = typeof mode === "string" ? mode : "voidResult";
  const copy = {
    undo: ["pcr.reason.undoTitle", "pcr.reason.undoDescription", "pcr.action.undo"],
    void: ["pcr.reason.voidTitle", "pcr.reason.voidDescription", "pcr.action.void"],
    voidResult: [
      "pcr.reason.voidResultTitle",
      "pcr.reason.voidResultDescription",
      "pcr.detail.voidResult",
    ],
  } as const;
  const [title, description, action] = copy[kind];
  const isShort = reason.trim().length < 10;
  return (
    <Dialog
      trigger={<span hidden />}
      title={t(title)}
      description={t(description)}
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (isShort) return;
          const text = reason.trim();
          if (typeof mode === "string") command.run({ kind: mode, reason: text });
          else command.run({ kind: "void_result", result_id: mode.resultId, reason: text });
        }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("pcr.reason.label")}
          <textarea
            value={reason}
            rows={3}
            maxLength={1000}
            required
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal"
            onChange={(event) => {
              setReason(event.currentTarget.value);
            }}
          />
          <span className="text-xs font-normal text-ink-3">{t("pcr.reason.hint")}</span>
        </label>
        {command.error && <InlineNotice tone="critical">{command.error}</InlineNotice>}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            aria-disabled={isShort || undefined}
            loading={command.isPending}
          >
            {t(action)}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

interface FilePickerProps {
  id: string;
  label: string;
  accept: readonly string[];
  typeError: string;
  file: File | undefined;
  error: string | undefined;
  onChange: (file: File | undefined, problem: string | undefined) => void;
}

export function FilePicker({
  id,
  label,
  accept,
  typeError,
  file,
  error,
  onChange,
}: FilePickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={id}
          type="file"
          accept={accept.join(",")}
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-tint file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-action-strong"
          onChange={(event) => {
            const picked = event.currentTarget.files?.[0];
            const problem = !picked
              ? undefined
              : !accept.includes(picked.type)
                ? typeError
                : picked.size > MAX_BYTES
                  ? t("pcr.file.tooLarge")
                  : undefined;
            onChange(problem ? undefined : picked, problem);
          }}
        />
      </div>
      {file && <span className="text-xs text-ink-2">{file.name}</span>}
      {error && (
        <span role="alert" className="text-xs font-semibold text-critical-fg">
          {error}
        </span>
      )}
    </div>
  );
}
