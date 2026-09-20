import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { computeSchedule, ScheduleEntry } from './scheduler';
import type { CommandItem, Graph, SimStatus } from './types';
import CommandPanel from './components/CommandPanel';
import EdgePanel from './components/EdgePanel';
import GraphView from './components/GraphView';
import SimControls from './components/SimControls';

interface SimState {
  status: SimStatus;
  /** 模拟时钟（秒） */
  now: number;
  /** 模拟使用的排程：id -> 起止时间（运行中仅同步未开始的口令） */
  plan: Record<string, ScheduleEntry>;
}

const LAST_VALID_KEY = 'stage-sandbox:last-valid-schedule';

function loadLastValid(): Record<string, ScheduleEntry> {
  try {
    return JSON.parse(localStorage.getItem(LAST_VALID_KEY) ?? '{}') as Record<string, ScheduleEntry>;
  } catch {
    return {};
  }
}

/** 将新排程合并进模拟计划：仅更新尚未开始的口令；已开始/已完成的保持原时间 */
function mergePlan(
  plan: Record<string, ScheduleEntry>,
  schedule: Record<string, ScheduleEntry>,
  commands: CommandItem[],
  now: number,
): Record<string, ScheduleEntry> {
  const next: Record<string, ScheduleEntry> = {};
  for (const c of commands) {
    const s = schedule[c.id];
    if (!s) continue;
    const cur = plan[c.id];
    const started = cur !== undefined && now >= cur.start;
    if (!started) {
      // 新排程的开始时刻已过 → 立即开始
      next[c.id] = s.start <= now ? { start: now, end: now + c.duration } : { ...s };
    } else {
      next[c.id] = cur;
    }
  }
  return next;
}

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>({ status: 'idle', now: 0, plan: {} });
  const [speed, setSpeed] = useState(1);

  const graphRef = useRef<Graph | null>(null);
  const nowRef = useRef(0);
  const speedRef = useRef(1);
  const lastValidRef = useRef<Record<string, ScheduleEntry>>(loadLastValid());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  graphRef.current = graph;
  nowRef.current = sim.now;
  speedRef.current = speed;

  /* ---------- 数据加载与持久化 ---------- */

  const reload = useCallback(async () => {
    try {
      setGraph(await api.getGraph());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 本地即时生效（驱动实时重算），防抖写回服务器 */
  const mutate = useCallback(
    (apply: (g: Graph) => Graph, persist: (g: Graph) => Promise<unknown>, debounceKey?: string) => {
      const current = graphRef.current;
      if (!current) return;
      const next = apply(current);
      setGraph(next);
      const fire = () => persist(next).catch((e) => {
        setError(e instanceof Error ? e.message : '保存失败');
        void reload();
      });
      if (debounceKey !== undefined) {
        clearTimeout(timersRef.current.get(debounceKey));
        timersRef.current.set(debounceKey, setTimeout(fire, 350));
      } else {
        void fire();
      }
    },
    [reload],
  );

  const addCommand = useCallback(
    (name: string, duration: number) => {
      void api
        .addCommand({ name, duration })
        .then((cmd) => setGraph((g) => (g ? { ...g, commands: [...g.commands, cmd] } : g)))
        .catch((e) => setError(e instanceof Error ? e.message : '添加失败'));
    },
    [],
  );

  const updateCommand = useCallback(
    (id: string, patch: Partial<Pick<CommandItem, 'name' | 'duration'>>) => {
      mutate(
        (g) => ({ ...g, commands: g.commands.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
        (g) => {
          const c = g.commands.find((x) => x.id === id);
          return c ? api.updateCommand(id, { name: c.name, duration: c.duration }) : Promise.resolve();
        },
        `cmd:${id}`,
      );
    },
    [mutate],
  );

  const deleteCommand = useCallback(
    (id: string) => {
      clearTimeout(timersRef.current.get(`cmd:${id}`));
      timersRef.current.delete(`cmd:${id}`);
      mutate(
        (g) => ({
          commands: g.commands.filter((c) => c.id !== id),
          edges: g.edges.filter((e) => e.from !== id && e.to !== id),
        }),
        () => api.deleteCommand(id),
      );
    },
    [mutate],
  );

  const addEdge = useCallback((from: string, to: string, minDelay: number) => {
    void api
      .addEdge({ from, to, minDelay })
      .then((edge) => setGraph((g) => (g ? { ...g, edges: [...g.edges, edge] } : g)))
      .catch((e) => setError(e instanceof Error ? e.message : '添加失败'));
  }, []);

  const updateEdge = useCallback(
    (id: string, minDelay: number) => {
      mutate(
        (g) => ({ ...g, edges: g.edges.map((e) => (e.id === id ? { ...e, minDelay } : e)) }),
        (g) => {
          const e = g.edges.find((x) => x.id === id);
          return e ? api.updateEdge(id, { minDelay: e.minDelay }) : Promise.resolve();
        },
        `edge:${id}`,
      );
    },
    [mutate],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      clearTimeout(timersRef.current.get(`edge:${id}`));
      timersRef.current.delete(`edge:${id}`);
      mutate(
        (g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) }),
        () => api.deleteEdge(id),
      );
    },
    [mutate],
  );

  /* ---------- 实时重算排程；成环时保留上次有效排程 ---------- */

  const result = useMemo(
    () => (graph ? computeSchedule(graph.commands, graph.edges) : null),
    [graph],
  );

  useEffect(() => {
    if (result?.ok) {
      lastValidRef.current = result.schedule;
      try {
        localStorage.setItem(LAST_VALID_KEY, JSON.stringify(result.schedule));
      } catch {
        /* ignore */
      }
    }
  }, [result]);

  /** 视图与模拟使用的有效排程：正常时为最新排程，成环时为上次有效排程 */
  const effectiveSchedule = useMemo(() => {
    if (!result) return {};
    if (result.ok) return result.schedule;
    const valid = lastValidRef.current;
    const ids = new Set((graph?.commands ?? []).map((c) => c.id));
    return Object.fromEntries(Object.entries(valid).filter(([id]) => ids.has(id)));
  }, [result, graph]);

  /* ---------- 模拟执行：时钟 + 排程同步 ---------- */

  // 编辑导致排程变化时，同步更新尚未执行的口令
  useEffect(() => {
    if (!graph) return;
    setSim((s) =>
      s.status === 'idle'
        ? { ...s, plan: effectiveSchedule }
        : { ...s, plan: mergePlan(s.plan, effectiveSchedule, graph.commands, nowRef.current) },
    );
  }, [effectiveSchedule, graph]);

  // 模拟时钟
  useEffect(() => {
    if (sim.status !== 'running') return;
    const timer = setInterval(() => {
      setSim((s) => {
        const now = s.now + 0.1 * speedRef.current;
        const maxEnd = Math.max(0, ...Object.values(s.plan).map((p) => p.end));
        if (maxEnd > 0 && now >= maxEnd) return { ...s, now: maxEnd, status: 'finished' };
        return { ...s, now };
      });
    }, 100);
    return () => clearInterval(timer);
  }, [sim.status]);

  const simStart = useCallback(() => {
    setSim({ status: 'running', now: 0, plan: { ...effectiveSchedule } });
  }, [effectiveSchedule]);
  const simPause = useCallback(() => setSim((s) => ({ ...s, status: 'paused' })), []);
  const simResume = useCallback(() => setSim((s) => ({ ...s, status: 'running' })), []);
  const simReset = useCallback(() => {
    setSim({ status: 'idle', now: 0, plan: { ...effectiveSchedule } });
  }, [effectiveSchedule]);

  /* ---------- 渲染 ---------- */

  if (!graph) {
    return <div className="boot">{error ? `加载失败：${error}` : '正在加载口令沙盘…'}</div>;
  }

  const cyclic = result !== null && !result.ok;

  return (
    <div className="app">
      <header className="app-header">
        <h1>舞台换景口令沙盘</h1>
        <p>编辑口令图（持续时长 + 前置完成后至少等待 N 秒），实时重算最早执行时间，并按排程模拟执行</p>
      </header>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)}>
          ⚠ {error}（点击关闭）
        </div>
      )}

      {cyclic && result && (
        <div className="banner banner-cycle">
          <strong>检测到环依赖：</strong>
          {result.cyclePathNames.join(' → ')}
          <span className="banner-note">已保留上次有效排程，视图与模拟均基于该排程；解除环后自动恢复实时排程。</span>
        </div>
      )}

      <main className="layout">
        <aside className="sidebar">
          <CommandPanel
            commands={graph.commands}
            schedule={effectiveSchedule}
            sim={sim}
            onAdd={addCommand}
            onUpdate={updateCommand}
            onDelete={deleteCommand}
          />
          <EdgePanel
            commands={graph.commands}
            edges={graph.edges}
            cycleEdgeIds={result?.cycleEdgeIds ?? []}
            onAdd={addEdge}
            onUpdate={updateEdge}
            onDelete={deleteEdge}
          />
        </aside>

        <section className="stage">
          <SimControls
            sim={sim}
            speed={speed}
            canRun={graph.commands.length > 0}
            onSpeedChange={setSpeed}
            onStart={simStart}
            onPause={simPause}
            onResume={simResume}
            onReset={simReset}
          />
          <GraphView
            commands={graph.commands}
            edges={graph.edges}
            plan={sim.plan}
            simStatus={sim.status}
            now={sim.now}
            cycleNodeIds={result?.cycleNodeIds ?? []}
            cycleEdgeIds={result?.cycleEdgeIds ?? []}
          />
        </section>
      </main>
    </div>
  );
}
