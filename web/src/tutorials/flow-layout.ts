import { linkEdge, linkTarget } from "./types";
import type { Tutorial } from "./types";

/** Geometry of the diagram in px (a computed canvas, not page styling). */
export const NODE_WIDTH = 132;
export const NODE_HEIGHT = 52;
const GAP_X = 44;
const GAP_Y = 20;
const PADDING = 12;

export interface FlowNode {
  id: string;
  layer: number;
  x: number;
  y: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  edge: "yes" | "no" | undefined;
  /** SVG path, from the right side of `from` to the left side of `to`. */
  path: string;
  /** End point (left side of `to`), where the arrow head goes. */
  endX: number;
  endY: number;
  /** Where the yes/no label sits. */
  labelX: number;
  labelY: number;
  fromLayer: number;
}

export interface FlowLayout {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

/** Layer of each step = its longest distance from the first step. Loops are ignored (guard). */
function layersOf(tutorial: Tutorial): Map<string, number> {
  const byId = new Map(tutorial.steps.map((step) => [step.id, step]));
  const layers = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string, layer: number): void => {
    if (visiting.has(id) || (layers.get(id) ?? -1) >= layer) return;
    layers.set(id, layer);
    visiting.add(id);
    for (const link of byId.get(id)?.next ?? []) visit(linkTarget(link), layer + 1);
    visiting.delete(id);
  };
  const first = tutorial.steps[0];
  if (first) visit(first.id, 0);
  return layers;
}

/** Step ids per layer, in the order the tutorial lists them. */
function columnsOf(tutorial: Tutorial, layers: Map<string, number>): Map<number, string[]> {
  const columns = new Map<number, string[]>();
  for (const step of tutorial.steps) {
    const layer = layers.get(step.id);
    if (layer !== undefined) columns.set(layer, [...(columns.get(layer) ?? []), step.id]);
  }
  return columns;
}

const columnHeight = (count: number) => count * NODE_HEIGHT + (count - 1) * GAP_Y;

/** One column per layer; the steps of a column are centered vertically. */
function placeNodes(columns: Map<number, string[]>, innerHeight: number): FlowNode[] {
  return [...columns].flatMap(([layer, ids]) => {
    const top = PADDING + (innerHeight - columnHeight(ids.length)) / 2;
    return ids.map((id, index) => ({
      id,
      layer,
      x: PADDING + layer * (NODE_WIDTH + GAP_X),
      y: top + index * (NODE_HEIGHT + GAP_Y),
    }));
  });
}

/** A curve from the right side of a step to the left side of the next one. */
function edgeBetween(from: FlowNode, to: FlowNode, edge: "yes" | "no" | undefined): FlowEdge {
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endY = to.y + NODE_HEIGHT / 2;
  const bend = (to.x - startX) / 2;
  const [c1, c2] = [startX + bend, to.x - bend].map(String);
  return {
    from: from.id,
    to: to.id,
    edge,
    path: `M ${String(startX)} ${String(startY)} C ${String(c1)} ${String(startY)}, ${String(c2)} ${String(endY)}, ${String(to.x)} ${String(endY)}`,
    endX: to.x,
    endY,
    labelX: startX + 6,
    labelY: startY + (endY >= startY ? 14 : -6),
    fromLayer: from.layer,
  };
}

function edgesOf(tutorial: Tutorial, nodes: FlowNode[]): FlowEdge[] {
  const position = new Map(nodes.map((node) => [node.id, node]));
  return tutorial.steps.flatMap((step) => {
    const from = position.get(step.id);
    if (!from) return [];
    return step.next.flatMap((link) => {
      const to = position.get(linkTarget(link));
      return to ? [edgeBetween(from, to, linkEdge(link))] : [];
    });
  });
}

/** Left-to-right layered layout of a tutorial's steps and the edges between them. */
export function layoutFlow(tutorial: Tutorial): FlowLayout {
  const columns = columnsOf(tutorial, layersOf(tutorial));
  const tallest = Math.max(1, ...[...columns.values()].map((ids) => ids.length));
  const innerHeight = columnHeight(tallest);
  const nodes = placeNodes(columns, innerHeight);
  const lastLayer = Math.max(0, ...nodes.map((node) => node.layer));
  return {
    nodes,
    edges: edgesOf(tutorial, nodes),
    width: PADDING * 2 + (lastLayer + 1) * NODE_WIDTH + lastLayer * GAP_X,
    height: PADDING * 2 + innerHeight,
  };
}
