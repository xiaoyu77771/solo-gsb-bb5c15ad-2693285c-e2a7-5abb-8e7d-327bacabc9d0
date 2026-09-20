import type { CommandItem, EdgeItem } from './types';

export interface ScheduleEntry {
  start: number;
  end: number;
}

export interface ScheduleResult {
  ok: boolean;
  /** id -> 最早开始/结束时间（仅 ok 时有值） */
  schedule: Record<string, ScheduleEntry>;
  /** 全部口令完成的总时长 */
  makespan: number;
  /** 成环节点与边（用于高亮） */
  cycleNodeIds: string[];
  cycleEdgeIds: string[];
  /** 成环路径上的口令名称（按依赖流向，首尾相接） */
  cyclePathNames: string[];
}

/**
 * 实时重算最早执行时间：
 *  - 无环：拓扑序前推，start(v) = max(前置end + minDelay)，无前置则为 0
 *  - 有环：返回成环路径（节点 + 边），调用方保留上次有效排程
 */
export function computeSchedule(commands: CommandItem[], edges: EdgeItem[]): ScheduleResult {
  const ids = new Set(commands.map((c) => c.id));
  const durationOf = new Map(commands.map((c) => [c.id, c.duration]));
  const incoming = new Map<string, EdgeItem[]>();
  const outgoing = new Map<string, EdgeItem[]>();
  const indegree = new Map<string, number>();
  for (const id of ids) {
    incoming.set(id, []);
    outgoing.set(id, []);
    indegree.set(id, 0);
  }
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    incoming.get(e.to)!.push(e);
    outgoing.get(e.from)!.push(e);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }

  // Kahn 拓扑排序
  const work = new Map(indegree);
  const queue: string[] = [];
  for (const id of ids) if ((work.get(id) ?? 0) === 0) queue.push(id);
  const topo: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    topo.push(u);
    for (const e of outgoing.get(u) ?? []) {
      const d = (work.get(e.to) ?? 0) - 1;
      work.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }

  if (topo.length < ids.size) {
    return { ...extractCycle(commands, incoming, work, ids), schedule: {}, makespan: 0, ok: false };
  }

  // 前推计算最早开始/结束时间
  const schedule: Record<string, ScheduleEntry> = {};
  for (const u of topo) {
    let start = 0;
    for (const e of incoming.get(u) ?? []) {
      const pred = schedule[e.from];
      if (pred) start = Math.max(start, pred.end + e.minDelay);
    }
    schedule[u] = { start, end: start + (durationOf.get(u) ?? 0) };
  }
  const makespan = Math.max(0, ...Object.values(schedule).map((s) => s.end));
  return { ok: true, schedule, makespan, cycleNodeIds: [], cycleEdgeIds: [], cyclePathNames: [] };
}

/**
 * 提取一条成环路径：Kahn 后仍有余度的节点必在环上或环的下游，
 * 沿“仍在剩余集合中的前置”不断回溯必然重复，重复段即环。
 */
function extractCycle(
  commands: CommandItem[],
  incoming: Map<string, EdgeItem[]>,
  indegreeWork: Map<string, number>,
  ids: Set<string>,
): Pick<ScheduleResult, 'cycleNodeIds' | 'cycleEdgeIds' | 'cyclePathNames'> {
  const remaining = new Set([...ids].filter((id) => (indegreeWork.get(id) ?? 0) > 0));
  const path: string[] = [];
  const indexOf = new Map<string, number>();
  let cur = [...remaining][0];
  while (cur && !indexOf.has(cur)) {
    indexOf.set(cur, path.length);
    path.push(cur);
    const pred = (incoming.get(cur) ?? []).find((e) => remaining.has(e.from));
    if (!pred) break;
    cur = pred.from;
  }
  const cycleNodes = indexOf.has(cur) ? path.slice(indexOf.get(cur)!) : [];
  // 回溯方向与依赖流向相反，翻转为正向流
  const flow = [...cycleNodes].reverse();
  const cycleEdgeIds: string[] = [];
  for (let i = 0; i < flow.length; i++) {
    const a = flow[i];
    const b = flow[(i + 1) % flow.length];
    const edge = (incoming.get(b) ?? []).find((e) => e.from === a);
    if (edge) cycleEdgeIds.push(edge.id);
  }
  const nameOf = (id: string) => commands.find((c) => c.id === id)?.name ?? id;
  const cyclePathNames = flow.length > 0 ? [...flow.map(nameOf), nameOf(flow[0])] : [];
  return { cycleNodeIds: flow, cycleEdgeIds, cyclePathNames };
}
