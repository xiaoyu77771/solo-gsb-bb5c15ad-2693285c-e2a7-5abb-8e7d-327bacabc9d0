import { CycleInfo, Project, ScheduleResult } from './types';

/**
 * 计算每个口令的最早开始时间（Kahn 拓扑排序，O(V+E)）。
 * 规则：start(to) >= start(from) + duration(from) + minDelay(edge)。
 * 若图中存在环依赖，返回 ok=false 并给出一条具体的成环路径用于高亮。
 */
export function computeSchedule(project: Project): ScheduleResult {
  const { nodes, edges } = project;
  const starts: Record<string, number> = {};
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, { to: string; minDelay: number }[]>();

  for (const n of nodes) {
    indegree.set(n.id, 0);
    outgoing.set(n.id, []);
    starts[n.id] = 0;
  }
  for (const e of edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue;
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    outgoing.get(e.from)!.push({ to: e.to, minDelay: e.minDelay });
  }

  const durationOf = new Map(nodes.map((n) => [n.id, n.duration]));
  const queue: string[] = [];
  for (const [id, deg] of indegree) {
    if (deg === 0) queue.push(id);
  }

  let processed = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    processed++;
    const finishAt = starts[id] + (durationOf.get(id) ?? 0);
    for (const { to, minDelay } of outgoing.get(id) ?? []) {
      const candidate = finishAt + minDelay;
      if (candidate > starts[to]) starts[to] = candidate;
      const deg = indegree.get(to)! - 1;
      indegree.set(to, deg);
      if (deg === 0) queue.push(to);
    }
  }

  if (processed === nodes.length) {
    let makespan = 0;
    for (const n of nodes) {
      makespan = Math.max(makespan, starts[n.id] + n.duration);
    }
    return { ok: true, starts, makespan };
  }

  return { ok: false, starts, makespan: 0, cycle: findCycle(project, indegree) };
}

/**
 * 在未被拓扑处理的剩余节点中找出一条具体的环路径。
 * 剩余子图中每个节点都至少有一条来自剩余节点的入边，
 * 因此沿“剩余前置”不断回溯必然重复，重复段即为一个环。
 */
function findCycle(project: Project, indegree: Map<string, number>): CycleInfo | undefined {
  const remaining = new Set<string>();
  for (const [id, deg] of indegree) {
    if (deg > 0) remaining.add(id);
  }
  if (remaining.size === 0) return undefined;

  // 剩余节点 -> 来自剩余节点的入边
  const incoming = new Map<string, { from: string; edgeId: string }[]>();
  for (const id of remaining) incoming.set(id, []);
  for (const e of project.edges) {
    if (remaining.has(e.from) && remaining.has(e.to)) {
      incoming.get(e.to)!.push({ from: e.from, edgeId: e.id });
    }
  }

  const start = remaining.values().next().value as string;
  const visitIndex = new Map<string, number>();
  const pathNodes: string[] = [];
  const pathEdges: string[] = [];
  let cur = start;

  while (!visitIndex.has(cur)) {
    visitIndex.set(cur, pathNodes.length);
    pathNodes.push(cur);
    const inc = incoming.get(cur);
    if (!inc || inc.length === 0) return undefined; // 理论上不会发生
    const next = inc[0];
    pathEdges.push(next.edgeId);
    cur = next.from;
  }

  const cycleStart = visitIndex.get(cur)!;
  return {
    nodeIds: pathNodes.slice(cycleStart),
    edgeIds: pathEdges.slice(cycleStart),
  };
}
