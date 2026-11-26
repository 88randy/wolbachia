import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FlowEdges, LAYER_DELAY_SECONDS } from "./FlowEdges";
import { FlowNodeButton } from "./FlowNodeButton";
import { layoutFlow, NODE_HEIGHT, NODE_WIDTH } from "./flow-layout";
import type { FlowLayout, FlowNode } from "./flow-layout";
import { stepKey } from "./tutorial-keys";
import type { Tutorial } from "./types";

interface FlowDiagramProps {
  tutorial: Tutorial;
  currentId: string;
  visited: ReadonlySet<string>;
  onSelect: (id: string) => void;
}

/** Keeps the current step visible when the diagram is wider than the modal. */
function useScrollToCurrent(currentId: string, isReduced: boolean) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: isReduced ? "auto" : "smooth",
    });
  }, [currentId, isReduced]);
  return ref;
}

function nodeStyle(node: FlowNode) {
  return { left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT };
}

interface NodesProps extends FlowDiagramProps {
  layout: FlowLayout;
  isReduced: boolean;
}

/** One button per step. The current one gets the ref so it can be scrolled into view. */
function DiagramNodes({ tutorial, layout, currentId, visited, onSelect, isReduced }: NodesProps) {
  const { t } = useTranslation();
  const currentRef = useScrollToCurrent(currentId, isReduced);
  return layout.nodes.map((node) => (
    <FlowNodeButton
      key={node.id}
      ref={node.id === currentId ? currentRef : undefined}
      label={t(stepKey(tutorial.id, node.id, "label"))}
      isDecision={tutorial.steps.find((step) => step.id === node.id)?.isDecision === true}
      isCurrent={node.id === currentId}
      isVisited={visited.has(node.id)}
      style={nodeStyle(node)}
      delaySeconds={isReduced ? 0 : node.layer * LAYER_DELAY_SECONDS}
      onSelect={() => {
        onSelect(node.id);
      }}
    />
  ));
}

/**
 * The animated step diagram: edges draw layer by layer, the current step is highlighted and
 * every step is a button. The step list next to it is its text equivalent.
 */
export function FlowDiagram(props: FlowDiagramProps) {
  const { t } = useTranslation();
  const isReduced = useReducedMotion() ?? false;
  const layout = useMemo(() => layoutFlow(props.tutorial), [props.tutorial]);
  return (
    <div
      role="group"
      aria-label={t("tutorials.diagram.label")}
      className="overflow-x-auto rounded-xl border border-line bg-surface-muted"
    >
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <FlowEdges
          edges={layout.edges}
          currentId={props.currentId}
          isReduced={isReduced}
          width={layout.width}
          height={layout.height}
        />
        <DiagramNodes {...props} layout={layout} isReduced={isReduced} />
      </div>
    </div>
  );
}
