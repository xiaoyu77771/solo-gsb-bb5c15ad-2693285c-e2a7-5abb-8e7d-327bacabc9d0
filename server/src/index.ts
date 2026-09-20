import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadGraph, saveGraph } from './store';
import { CommandItem, EdgeItem } from './types';

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/* ---------- 查询 ---------- */

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/graph', (_req: Request, res: Response) => {
  res.json(loadGraph());
});

/* ---------- 口令 ---------- */

app.post('/api/commands', (req: Request, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const duration = num(req.body?.duration);
  if (!name) return res.status(400).json({ error: '口令名称不能为空' });
  if (duration === null || duration < 0) return res.status(400).json({ error: '持续时长必须是不小于 0 的数字' });

  const g = loadGraph();
  const cmd: CommandItem = { id: crypto.randomUUID(), name, duration };
  saveGraph({ ...g, commands: [...g.commands, cmd] });
  res.status(201).json(cmd);
});

app.put('/api/commands/:id', (req: Request, res: Response) => {
  const g = loadGraph();
  const cmd = g.commands.find((c) => c.id === req.params.id);
  if (!cmd) return res.status(404).json({ error: '口令不存在' });

  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: '口令名称不能为空' });
    cmd.name = name;
  }
  if (req.body?.duration !== undefined) {
    const duration = num(req.body.duration);
    if (duration === null || duration < 0) return res.status(400).json({ error: '持续时长必须是不小于 0 的数字' });
    cmd.duration = duration;
  }
  saveGraph(g);
  res.json(cmd);
});

app.delete('/api/commands/:id', (req: Request, res: Response) => {
  const g = loadGraph();
  const id = req.params.id;
  if (!g.commands.some((c) => c.id === id)) return res.status(404).json({ error: '口令不存在' });
  // 删除口令时级联删除相关依赖边
  saveGraph({
    commands: g.commands.filter((c) => c.id !== id),
    edges: g.edges.filter((e) => e.from !== id && e.to !== id),
  });
  res.json({ ok: true });
});

/* ---------- 依赖边 ---------- */

app.post('/api/edges', (req: Request, res: Response) => {
  const { from, to } = req.body ?? {};
  const minDelay = num(req.body?.minDelay);
  const g = loadGraph();
  const has = (id: unknown) => typeof id === 'string' && g.commands.some((c) => c.id === id);
  if (!has(from) || !has(to)) return res.status(400).json({ error: '前置/后续口令不存在' });
  if (from === to) return res.status(400).json({ error: '不允许口令依赖自身' });
  if (minDelay === null || minDelay < 0) return res.status(400).json({ error: '等待时长必须是不小于 0 的数字' });
  if (g.edges.some((e) => e.from === from && e.to === to)) {
    return res.status(409).json({ error: '该依赖关系已存在，可直接修改其等待时长' });
  }

  const edge: EdgeItem = { id: crypto.randomUUID(), from, to, minDelay };
  saveGraph({ ...g, edges: [...g.edges, edge] });
  res.status(201).json(edge);
});

app.put('/api/edges/:id', (req: Request, res: Response) => {
  const g = loadGraph();
  const edge = g.edges.find((e) => e.id === req.params.id);
  if (!edge) return res.status(404).json({ error: '依赖关系不存在' });
  if (req.body?.minDelay !== undefined) {
    const minDelay = num(req.body.minDelay);
    if (minDelay === null || minDelay < 0) return res.status(400).json({ error: '等待时长必须是不小于 0 的数字' });
    edge.minDelay = minDelay;
  }
  saveGraph(g);
  res.json(edge);
});

app.delete('/api/edges/:id', (req: Request, res: Response) => {
  const g = loadGraph();
  const id = req.params.id;
  if (!g.edges.some((e) => e.id === id)) return res.status(404).json({ error: '依赖关系不存在' });
  saveGraph({ ...g, edges: g.edges.filter((e) => e.id !== id) });
  res.json({ ok: true });
});

/* ---------- 生产模式：托管前端静态文件 ---------- */

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  loadGraph(); // 启动即完成数据初始化
  console.log(`[server] 舞台换景口令沙盘已启动: http://localhost:${PORT}`);
});
