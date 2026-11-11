import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { FlowEdge } from "./flow-layout";

const EDGE_SECONDS = 0.45;
export const LAYER_DELAY_SECONDS = 0.22;

function arrowPoints({ endX, endY }: FlowEdge): string {
  return `${String(endX)},${String(endY)} ${String(endX - 8)},${String(endY - 5)} ${String(endX - 8)},${String(endY + 5)}`;
}

interface EdgeShapeProps {
  edge: FlowEdge;
  isActive: boolean;
  isReduced: boolean;
}

/** One edge: the line draws itself (layer by layer), then its arrow head fades in. */
function EdgeShape({ edge, isActive, isReduced }: EdgeShapeProps) {
  const delay = isReduced ? 0 : edge.fromLayer * LAYER_DELAY_SECONDS;
  const duration = isReduced ? 0 : EDGE_SECONDS;
  const tone = isActive ? "fill-action stroke-action" : "fill-line-strong stroke-line-strong";
  return (
    <g className={tone}>
      <motion.path
        d={edge.path}
        fill="none"
        strokeWidth={isActive ? 2.5 : 1.5}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay, duration, ease: "easeOut" }}
      />
      <motion.polygon
        points={arrowPoints(edge)}
        stroke="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + duration, duration: isReduced ? 0 : 0.15 }}
      />
    </g>
  );
}

/** The Yes / No words on the branches of a question. */
function EdgeLabels({ edges }: { edges: readonly FlowEdge[] }) {
  const { t } = useTranslation();
  return edges.map((edge) =>
    edge.edge ? (
      <span
        key={`label-${edge.from}-${edge.to}`}
        aria-hidden="true"
        className="pointer-events-none absolute text-xs leading-4 font-semibold text-ink-2"
        style={{ left: edge.labelX, top: edge.labelY - 8 }}
      >
        {t(`tutorials.edge.${edge.edge}`)}
      </span>
    ) : null,
  );
}

interface FlowEdgesProps {
  edges: readonly FlowEdge[];
  currentId: string;
  isReduced: boolean;
  width: number;
  height: number;
}

/** The lines of the diagram. Decorative: the step list says the same in text. */
export function FlowEdges({ edges, currentId, isReduced, width, height }: FlowEdgesProps) {
  return (
    <>
      <svg
        aria-hidden="true"
        width={width}
        height={height}
        className="pointer-events-none absolute inset-0"
      >
        {edges.map((edge) => (
          <EdgeShape
            key={`${edge.from}-${edge.to}`}
            edge={edge}
            isActive={edge.from === currentId || edge.to === currentId}
            isReduced={isReduced}
          />
        ))}
      </svg>
      <EdgeLabels edges={edges} />
    </>
  );
}
