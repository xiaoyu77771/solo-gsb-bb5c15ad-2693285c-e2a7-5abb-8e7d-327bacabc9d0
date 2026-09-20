import { CycleInfo, NodeRuntime, Project, ScheduleResult } from './types';

interface TimelineProps {
  project: Project;
  schedule: ScheduleResult | null;
  cycle?: CycleInfo;
  runtime: Record<string, NodeRuntime>;
  simTime: number;
  simActive: boolean;
}

const ROW_H = 26;
const LABEL_W = 110;
const PX_PER_SEC = 14;

/** 甘特图：按排程展示每条口令的执行窗口，模拟时叠加当前时刻线。 */
export function Timeline(props: TimelineProps) {
  const { project, schedule, cycle, runtime, simTime, simActive } = props;
  if (!schedule || project.nodes.length === 0) {
    return <div className="timeline empty">暂无有效排程</div>;
  }

  const cycleNodes = new Set(cycle?.nodeIds ?? []);
  const rows = [...project.nodes].sort(
    (a, b) => (schedule.starts[a.id] ?? 0) - (schedule.starts[b.id] ?? 0),
  );
  const width = Math.max(schedule.makespan * PX_PER_SEC + 40, 200);
  const height = rows.length * ROW_H + 24;

  const ticks: number[] = [];
  const tickStep = niceStep(schedule.makespan / 8);
  for (let t = 0; t <= schedule.makespan + 1e-6; t += tickStep) {
    ticks.push(Math.round(t * 10) / 10);
  }

  return (
    <div className="timeline">
      <svg width={LABEL_W + width} height={height}>
        {ticks.map((t) => (
          <g key={t} transform={`translate(${LABEL_W + t * PX_PER_SEC},0)`}>
            <line y1={16} y2={height} className="tick-line" />
            <text y={12} textAnchor="middle" className="tick-label">
              {t}s
            </text>
          </g>
        ))}
        {rows.map((n, i) => {
          const y = 20 + i * ROW_H;
          const start = schedule.starts[n.id] ?? 0;
          const rt = runtime[n.id];
          const status = rt?.status ?? 'pending';
          const barStart = rt?.start ?? start;
          const barEnd = rt?.end ?? start + n.duration;
          return (
            <g key={n.id}>
              <text x={LABEL_W - 8} y={y + ROW_H / 2 + 4} textAnchor="end" className={`row-label ${cycleNodes.has(n.id) ? 'cycle' : ''}`}>
                {n.name}
              </text>
              <rect
                x={LABEL_W + barStart * PX_PER_SEC}
                y={y + 4}
                width={Math.max((barEnd - barStart) * PX_PER_SEC, 3)}
                height={ROW_H - 8}
                rx={4}
                className={`bar status-${status} ${cycleNodes.has(n.id) ? 'cycle' : ''}`}
              />
              <text
                x={LABEL_W + barStart * PX_PER_SEC + 5}
                y={y + ROW_H / 2 + 4}
                className="bar-label"
              >
                {round1(barStart)}s → {round1(barEnd)}s
              </text>
            </g>
          );
        })}
        {simActive && (
          <line
            x1={LABEL_W + simTime * PX_PER_SEC}
            x2={LABEL_W + simTime * PX_PER_SEC}
            y1={14}
            y2={height}
            className="now-line"
          />
        )}
      </svg>
    </div>
  );
}

function round1(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 5;
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const c of candidates) if (c >= raw) return c;
  return Math.ceil(raw);
}
