import type { CommandItem, EdgeItem, SimStatus } from '../types';
import type { ScheduleEntry } from '../scheduler';
import { fmt, runStateOf } from '../format';

const PX = 36; // 每秒像素
const NODE_H = 34;
const LANE_H = 54;
const TOP = 38;
const LEFT = 12;

interface Props {
  commands: CommandItem[];
  edges: EdgeItem[];
  plan: Record<string, ScheduleEntry>;
  simStatus: SimStatus;
  now: number;
  cycleNodeIds: string[];
  cycleEdgeIds: string[];
}

/** 甘特式泳道分配：按开始时间贪心放入首个不重叠泳道 */
function assignLanes(plan: Record<string, ScheduleEntry>): Map<string, number> {
  const laneOf = new Map<string, number>();
  const laneEnds: number[] = [];
  const sorted = Object.entries(plan).sort((a, b) => a[1].start - b[1].start || a[1].end - b[1].end);
  for (const [id, s] of sorted) {
    let lane = laneEnds.findIndex((end) => end <= s.start + 1e-9);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = s.end;
    laneOf.set(id, lane);
  }
  return laneOf;
}

function tickStep(maxT: number): number {
  for (const s of [1, 2, 5, 10, 20, 30, 60, 120]) {
    if (s * PX >= 50 && maxT / s <= 40) return s;
  }
  return 300;
}

export default function GraphView({ commands, edges, plan, simStatus, now, cycleNodeIds, cycleEdgeIds }: Props) {
  if (commands.length === 0) {
    return <div className="graph-empty">暂无口令 — 在左侧添加口令与依赖约束后，这里将展示排程时间轴</div>;
  }

  const laneOf = assignLanes(plan);
  const laneCount = Math.max(1, ...laneOf.values(), 0) + 1;
  const makespan = Math.max(0, ...Object.values(plan).map((p) => p.end));
  const maxT = Math.max(makespan, simStatus !== 'idle' ? now : 0, 5);
  const width = LEFT * 2 + maxT * PX + 90;
  const height = TOP + laneCount * LANE_H + 24;

  const x = (t: number) => LEFT + t * PX;
  const yOf = (id: string) => TOP + (laneOf.get(id) ?? 0) * LANE_H;
  const cyOf = (id: string) => yOf(id) + NODE_H / 2;

  const step = tickStep(maxT);
  const ticks: number[] = [];
  for (let t = 0; t <= maxT + 1e-9; t += step) ticks.push(t);

  return (
    <div className="graph-scroll">
      <svg width={width} height={height} className="graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" className="arrow-head" />
          </marker>
          <marker id="arrow-cycle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" className="arrow-head-cycle" />
          </marker>
        </defs>

        {/* 时间刻度 */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={TOP - 14} x2={x(t)} y2={height - 16} className="grid-line" />
            <text x={x(t)} y={TOP - 20} className="tick-label" textAnchor="middle">
              {fmt(t)}
            </text>
          </g>
        ))}

        {/* 依赖边 */}
        {edges.map((e) => {
          const from = plan[e.from];
          const to = plan[e.to];
          if (!from || !to) return null;
          const x1 = x(from.end);
          const y1 = cyOf(e.from);
          const x2 = x(to.start);
          const y2 = cyOf(e.to);
          const bend = Math.max(18, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 3);
          const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
          const isCycle = cycleEdgeIds.includes(e.id);
          return (
            <g key={e.id}>
              <path d={d} className={isCycle ? 'edge edge-cycle' : 'edge'} markerEnd={isCycle ? 'url(#arrow-cycle)' : 'url(#arrow)'} />
              {e.minDelay > 0 && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} className={isCycle ? 'edge-label edge-label-cycle' : 'edge-label'} textAnchor="middle">
                  +{fmt(e.minDelay)}
                </text>
              )}
            </g>
          );
        })}

        {/* 口令节点 */}
        {commands.map((c) => {
          const s = plan[c.id];
          if (!s) return null;
          const nx = x(s.start);
          const nw = Math.max(c.duration * PX, 30);
          const ny = yOf(c.id);
          const state = runStateOf(s, now);
          const isCycle = cycleNodeIds.includes(c.id);
          const progress = c.duration > 0 ? Math.min(1, Math.max(0, (now - s.start) / c.duration)) : state === 'done' ? 1 : 0;
          const maxChars = Math.max(3, Math.floor(nw / 12));
          const label = c.name.length > maxChars ? `${c.name.slice(0, maxChars - 1)}…` : c.name;
          return (
            <g key={c.id} className={`node node-${simStatus === 'idle' ? 'pending' : state} ${isCycle ? 'node-cycle' : ''}`}>
              <rect x={nx} y={ny} width={nw} height={NODE_H} rx={6} className="node-box" />
              {simStatus !== 'idle' && state !== 'pending' && (
                <rect x={nx} y={ny + NODE_H - 5} width={nw * progress} height={5} rx={2.5} className="node-progress" />
              )}
              <text x={nx + nw / 2} y={ny + 14} className="node-name" textAnchor="middle">
                {label}
              </text>
              <text x={nx + nw / 2} y={ny + 28} className="node-time" textAnchor="middle">
                {fmt(s.start)}–{fmt(s.end)}
              </text>
            </g>
          );
        })}

        {/* 模拟时钟线 */}
        {simStatus !== 'idle' && (
          <g className="now-line">
            <line x1={x(now)} y1={TOP - 14} x2={x(now)} y2={height - 16} />
            <text x={x(now)} y={TOP - 20} textAnchor="middle" className="now-label">
              ▼ {fmt(Math.round(now * 10) / 10)}
            </text>
          </g>
        )}
      </svg>

      <div className="legend">
        <span><i className="dot dot-pending" />未开始</span>
        <span><i className="dot dot-running" />执行中</span>
        <span><i className="dot dot-done" />已完成</span>
        <span><i className="dot dot-cycle" />环依赖</span>
        <span className="legend-note">连线标注 +Ns 表示前置完成后至少等待 N 秒</span>
      </div>
    </div>
  );
}
