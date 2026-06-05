export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight?: number;
}

export interface FloorGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type AdjacencyMap = Map<string, Array<{ nodeId: string; cost: number }>>;

/** JSON 문자열 → FloorGraph 파싱. 실패 시 null */
export function parseGraph(json: string | null | undefined): FloorGraph | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
    return data as FloorGraph;
  } catch {
    return null;
  }
}

/** 양방향 인접 리스트 생성 */
export function buildAdjacency(graph: FloorGraph): AdjacencyMap {
  const adj: AdjacencyMap = new Map();

  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const cost = edge.weight ?? euclidean(graph, edge.from, edge.to);
    adj.get(edge.from)?.push({ nodeId: edge.to, cost });
    adj.get(edge.to)?.push({ nodeId: edge.from, cost }); // 양방향
  }

  return adj;
}

function euclidean(graph: FloorGraph, idA: string, idB: string): number {
  const a = graph.nodes.find((n) => n.id === idA);
  const b = graph.nodes.find((n) => n.id === idB);
  if (!a || !b) return 1;
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Dijkstra 최단 경로. 반환값: node id 배열 (출발 포함) 또는 null */
export function findPath(
  graph: FloorGraph,
  fromId: string,
  toId: string,
  adj?: AdjacencyMap
): string[] | null {
  const adjacency = adj ?? buildAdjacency(graph);

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const node of graph.nodes) {
    dist.set(node.id, Infinity);
    prev.set(node.id, null);
  }
  dist.set(fromId, 0);

  while (true) {
    // 방문하지 않은 노드 중 거리 최솟값
    let current: string | null = null;
    let minDist = Infinity;
    for (const [id, d] of dist.entries()) {
      if (!visited.has(id) && d < minDist) {
        minDist = d;
        current = id;
      }
    }

    if (current === null || current === toId) break;
    visited.add(current);

    for (const { nodeId, cost } of adjacency.get(current) ?? []) {
      if (visited.has(nodeId)) continue;
      const newDist = (dist.get(current) ?? Infinity) + cost;
      if (newDist < (dist.get(nodeId) ?? Infinity)) {
        dist.set(nodeId, newDist);
        prev.set(nodeId, current);
      }
    }
  }

  // 경로 복원
  if ((dist.get(toId) ?? Infinity) === Infinity) return null;

  const path: string[] = [];
  let cur: string | null = toId;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }

  return path.length > 0 && path[0] === fromId ? path : null;
}

/** path(node id 배열) → SVG polyline points 문자열 */
export function pathToPolylinePoints(path: string[], nodes: GraphNode[]): string {
  return path
    .map((id) => {
      const node = nodes.find((n) => n.id === id);
      return node ? `${node.x},${node.y}` : null;
    })
    .filter(Boolean)
    .join(" ");
}

/** 다각형 centroid 계산 (방 노드 자동 추가용) */
export function polygonCentroid(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [Math.round(cx), Math.round(cy)];
}
