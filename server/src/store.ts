import fs from 'fs';
import path from 'path';
import { Graph } from './types';
import { seedGraph } from './seed';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'graph.json');

let cache: Graph | null = null;

function isValidGraph(g: unknown): g is Graph {
  if (!g || typeof g !== 'object') return false;
  const graph = g as Graph;
  if (!Array.isArray(graph.commands) || !Array.isArray(graph.edges)) return false;
  const ids = new Set<string>();
  for (const c of graph.commands) {
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.duration !== 'number') return false;
    if (ids.has(c.id)) return false;
    ids.add(c.id);
  }
  for (const e of graph.edges) {
    if (!e || typeof e.id !== 'string' || !ids.has(e.from) || !ids.has(e.to)) return false;
    if (typeof e.minDelay !== 'number') return false;
  }
  return true;
}

/** 启动时加载；文件缺失或损坏时写入种子数据完成初始化 */
export function loadGraph(): Graph {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (isValidGraph(parsed)) {
      cache = parsed;
      return cache;
    }
    console.warn('[store] 数据文件格式无效，已重置为种子数据');
  } catch {
    console.log('[store] 未找到数据文件，初始化种子数据');
  }
  cache = seedGraph();
  persist(cache);
  return cache;
}

/** 原子写入本地 JSON 文件，保证数据持久化到本地磁盘 */
export function persist(g: Graph): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(g, null, 2), 'utf-8');
  fs.renameSync(tmp, FILE);
}

export function saveGraph(g: Graph): Graph {
  cache = g;
  persist(g);
  return g;
}
