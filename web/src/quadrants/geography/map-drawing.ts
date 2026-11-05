import { parseLocation } from "./geometry";
/** Append to the outer ring before its closure, keeping existing holes unchanged. */
export function appendMapVertex(text: string | undefined, location: number[]): string {
  const rings = text?.trim().split(/\n\s*\n/) ?? [""];
  const outer = rings[0]?.split("\n").filter(Boolean) ?? [];
  const isClosed = isClosedRing(outer);
  if (isClosed) outer.pop();
  outer.push(location.join(","));
  if (isClosed) outer.push(outer[0] ?? "");
  return [outer.join("\n"), ...rings.slice(1)].join("\n\n");
}
function isClosedRing(vertices: string[]): boolean {
  const first = parseLocation(vertices[0] ?? "");
  const last = parseLocation(vertices.at(-1) ?? "");
  return vertices.length > 1 && first !== null && first.join() === last?.join();
}

/** Remove only the exterior's final vertex; its existing closing coordinate and holes stay intact. */
export function undoMapVertex(text: string): string {
  const rings = text.split(/(\r?\n[ \t]*\r?\n)/);
  const outer = (rings[0] ?? "").split("\n");
  const index = isClosedRing(outer) ? outer.length - 2 : outer.length - 1;
  outer.splice(index, 1);
  rings[0] = outer.join("\n");
  return rings.join("");
}
