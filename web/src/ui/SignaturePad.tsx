import { Check, Eraser } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

type Point = readonly [number, number];
const HEIGHT = 176;
const MIN_INK = 60; // CSS px of line: a single dot is not a signature
const MAX_POINTS = 4096;
const MAX_STROKES = 128;

function inkLength(strokes: readonly (readonly Point[])[]) {
  let total = 0;
  for (const stroke of strokes)
    for (let i = 1; i < stroke.length; i += 1) {
      const [x0, y0] = stroke[i - 1] ?? [0, 0];
      const [x1, y1] = stroke[i] ?? [0, 0];
      total += Math.hypot(x1 - x0, y1 - y0);
    }
  return total;
}

function drawAll(canvas: HTMLCanvasElement, strokes: readonly (readonly Point[])[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = canvas.width / canvas.clientWidth || 1;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.clientWidth, HEIGHT);
  context.strokeStyle = "#0a1a3f";
  context.lineWidth = 2.2;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    context.beginPath();
    stroke.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    if (stroke.length === 1) context.lineTo((stroke[0]?.[0] ?? 0) + 0.1, stroke[0]?.[1] ?? 0);
    context.stroke();
  }
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

export interface SignaturePadProps {
  id: string;
  /** Who signs, already translated ("Firma: Walter Rosado Lara"). */
  label: string;
  /** Called with the PNG of the signature, or null when it is cleared or still too short. */
  onChange: (png: Blob | null) => void;
  /** The signature is ready (captured and, if needed, uploaded). */
  isReady?: boolean;
  disabled?: boolean;
}

/**
 * A drawn signature: mouse, finger or pen on a canvas. A single dot is refused. The image is
 * exported as a PNG and handed to the caller; nothing is stored or sent from here.
 */
export function SignaturePad(props: SignaturePadProps) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<(readonly Point[])[]>([]);
  const drawing = useRef<Point[] | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [isTooShort, setTooShort] = useState(false);

  const resize = useCallback(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(element.clientWidth * ratio);
    element.height = Math.round(HEIGHT * ratio);
    drawAll(element, strokes.current);
  }, []);
  useEffect(() => {
    resize();
    const element = canvas.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [resize]);

  const position = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };
  const finish = async () => {
    const element = canvas.current;
    const stroke = drawing.current;
    drawing.current = null;
    if (!element || !stroke) return;
    strokes.current = [...strokes.current, stroke].slice(-MAX_STROKES);
    const long = inkLength(strokes.current) >= MIN_INK;
    setHasInk(true);
    setTooShort(!long);
    props.onChange(long ? await toBlob(element) : null);
  };
  const clear = () => {
    strokes.current = [];
    drawing.current = null;
    setHasInk(false);
    setTooShort(false);
    if (canvas.current) drawAll(canvas.current, []);
    props.onChange(null);
  };
  const disabled = props.disabled === true;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={`${props.id}-label`} className="text-xs font-bold text-ink">
        {props.label}
      </span>
      <div className="relative min-w-0 overflow-hidden rounded-xl border border-line-strong bg-white">
        <canvas
          ref={canvas}
          id={props.id}
          role="img"
          aria-labelledby={`${props.id}-label`}
          className="block w-full touch-none"
          style={{ height: HEIGHT, cursor: disabled ? "not-allowed" : "crosshair" }}
          onPointerDown={(event) => {
            if (disabled || (drawing.current?.length ?? 0) > MAX_POINTS) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = [position(event)];
            setHasInk(true);
          }}
          onPointerMove={(event) => {
            const stroke = drawing.current;
            if (!stroke || stroke.length >= MAX_POINTS) return;
            stroke.push(position(event));
            if (canvas.current) drawAll(canvas.current, [...strokes.current, stroke]);
          }}
          onPointerUp={() => {
            void finish();
          }}
          onPointerCancel={() => {
            void finish();
          }}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-ink-3">
            {t("ui.signaturePad.placeholder")}
          </span>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-line-strong"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          leadingIcon={<Eraser aria-hidden="true" />}
          disabled={disabled || !hasInk}
          onClick={clear}
        >
          {t("ui.signaturePad.clear")}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="m-0 inline-flex items-center gap-1.5 text-sm"
        >
          {props.isReady ? (
            <>
              <Check aria-hidden="true" className="size-4 text-success-fg" />
              <span className="font-semibold text-success-fg">{t("ui.signaturePad.ready")}</span>
            </>
          ) : isTooShort ? (
            <span className="text-warning-fg">{t("ui.signaturePad.tooShort")}</span>
          ) : (
            <span className="text-ink-2">{t("ui.signaturePad.hint")}</span>
          )}
        </p>
      </div>
    </div>
  );
}
