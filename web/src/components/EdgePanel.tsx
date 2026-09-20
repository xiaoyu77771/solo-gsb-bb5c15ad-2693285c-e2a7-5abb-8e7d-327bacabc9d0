import { FormEvent, useState } from 'react';
import type { CommandItem, EdgeItem } from '../types';
import NumberField from './NumberField';

interface Props {
  commands: CommandItem[];
  edges: EdgeItem[];
  cycleEdgeIds: string[];
  onAdd: (from: string, to: string, minDelay: number) => void;
  onUpdate: (id: string, minDelay: number) => void;
  onDelete: (id: string) => void;
}

export default function EdgePanel({ commands, edges, cycleEdgeIds, onAdd, onUpdate, onDelete }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minDelay, setMinDelay] = useState('0');

  const nameOf = (id: string) => commands.find((c) => c.id === id)?.name ?? '?';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const d = Number(minDelay);
    if (!from || !to || from === to || !Number.isFinite(d) || d < 0) return;
    onAdd(from, to, d);
    setFrom('');
    setTo('');
    setMinDelay('0');
  };

  return (
    <section className="panel">
      <h2>依赖约束</h2>
      <p className="panel-hint">前置口令完成后，至少等待 N 秒方可执行后续口令</p>
      <table className="table">
        <thead>
          <tr>
            <th>前置口令</th>
            <th />
            <th>后续口令</th>
            <th className="col-num">至少等待</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {edges.map((e) => (
            <tr key={e.id} className={cycleEdgeIds.includes(e.id) ? 'row-cycle' : ''}>
              <td>{nameOf(e.from)}</td>
              <td className="arrow">→</td>
              <td>{nameOf(e.to)}</td>
              <td>
                <NumberField
                  className="input input-num"
                  value={e.minDelay}
                  onCommit={(n) => onUpdate(e.id, n)}
                />
              </td>
              <td>
                <button className="btn btn-danger" title="删除依赖" onClick={() => onDelete(e.id)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {edges.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                暂无依赖约束
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="add-form" onSubmit={submit}>
        <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">前置口令…</option>
          {commands.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">后续口令…</option>
          {commands
            .filter((c) => c.id !== from)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <input
          className="input input-num"
          type="number"
          min={0}
          step={0.5}
          value={minDelay}
          onChange={(e) => setMinDelay(e.target.value)}
          title="至少等待（秒）"
        />
        <button className="btn btn-primary" type="submit" disabled={!from || !to}>
          + 添加依赖
        </button>
      </form>
    </section>
  );
}
