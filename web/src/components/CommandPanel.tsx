import { FormEvent, useState } from 'react';
import type { CommandItem, SimStatus } from '../types';
import type { ScheduleEntry } from '../scheduler';
import { fmt, runStateOf } from '../format';
import NumberField from './NumberField';

interface Props {
  commands: CommandItem[];
  schedule: Record<string, ScheduleEntry>;
  sim: { status: SimStatus; now: number; plan: Record<string, ScheduleEntry> };
  onAdd: (name: string, duration: number) => void;
  onUpdate: (id: string, patch: Partial<Pick<CommandItem, 'name' | 'duration'>>) => void;
  onDelete: (id: string) => void;
}

const STATE_LABEL = { pending: '未开始', running: '执行中', done: '已完成' } as const;

export default function CommandPanel({ commands, schedule, sim, onAdd, onUpdate, onDelete }: Props) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('3');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const d = Number(duration);
    if (!name.trim() || !Number.isFinite(d) || d < 0) return;
    onAdd(name.trim(), d);
    setName('');
    setDuration('3');
  };

  const simActive = sim.status !== 'idle';

  return (
    <section className="panel">
      <h2>口令</h2>
      <table className="table">
        <thead>
          <tr>
            <th>名称</th>
            <th className="col-num">时长</th>
            <th className="col-num">最早开始</th>
            <th className="col-num">最早结束</th>
            {simActive && <th>状态</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {commands.map((c) => {
            const s = schedule[c.id];
            const p = sim.plan[c.id];
            const state = runStateOf(p, sim.now);
            return (
              <tr key={c.id} className={simActive ? `row-${state}` : ''}>
                <td>
                  <input
                    className="input input-name"
                    value={c.name}
                    onChange={(e) => onUpdate(c.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <NumberField
                    className="input input-num"
                    value={c.duration}
                    onCommit={(n) => onUpdate(c.id, { duration: n })}
                  />
                </td>
                <td className="col-num mono">{s ? fmt(s.start) : '—'}</td>
                <td className="col-num mono">{s ? fmt(s.end) : '—'}</td>
                {simActive && (
                  <td>
                    <span className={`badge badge-${state}`}>{STATE_LABEL[state]}</span>
                  </td>
                )}
                <td>
                  <button className="btn btn-danger" title="删除口令" onClick={() => onDelete(c.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          {commands.length === 0 && (
            <tr>
              <td colSpan={6} className="empty">
                暂无条件，请在下方添加
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="add-form" onSubmit={submit}>
        <input
          className="input input-name"
          placeholder="新口令名称，如：追光就位"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input input-num"
          type="number"
          min={0}
          step={0.5}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          title="持续时长（秒）"
        />
        <button className="btn btn-primary" type="submit">
          + 添加口令
        </button>
      </form>
    </section>
  );
}
