import type { SimStatus } from '../types';
import type { ScheduleEntry } from '../scheduler';
import { fmt } from '../format';

interface Props {
  sim: { status: SimStatus; now: number; plan: Record<string, ScheduleEntry> };
  speed: number;
  canRun: boolean;
  onSpeedChange: (s: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

const SPEEDS = [1, 2, 4];

export default function SimControls({ sim, speed, canRun, onSpeedChange, onStart, onPause, onResume, onReset }: Props) {
  const total = Math.max(0, ...Object.values(sim.plan).map((p) => p.end));
  const pct = total > 0 ? Math.min(100, (sim.now / total) * 100) : 0;

  return (
    <div className="sim-bar">
      <div className="sim-buttons">
        {sim.status === 'idle' && (
          <button className="btn btn-go" onClick={onStart} disabled={!canRun}>
            ▶ 开始模拟
          </button>
        )}
        {sim.status === 'running' && (
          <button className="btn btn-warn" onClick={onPause}>
            ⏸ 暂停
          </button>
        )}
        {sim.status === 'paused' && (
          <button className="btn btn-go" onClick={onResume}>
            ⏵ 继续
          </button>
        )}
        {sim.status === 'finished' && (
          <button className="btn btn-go" onClick={onStart} disabled={!canRun}>
            ↻ 重新模拟
          </button>
        )}
        <button className="btn" onClick={onReset} disabled={sim.status === 'idle'}>
          ⟲ 重置
        </button>
      </div>

      <div className="sim-progress">
        <div className="sim-progress-track">
          <div className="sim-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="sim-time mono">
          T = {fmt(Math.round(sim.now * 10) / 10)} / {fmt(total)}
        </span>
      </div>

      <div className="sim-speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`btn btn-chip ${speed === s ? 'active' : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
