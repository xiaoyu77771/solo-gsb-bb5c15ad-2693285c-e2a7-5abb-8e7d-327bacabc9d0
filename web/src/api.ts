import type { CommandItem, EdgeItem, Graph } from './types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getGraph: () => req<Graph>('/api/graph'),
  addCommand: (data: { name: string; duration: number }) =>
    req<CommandItem>('/api/commands', { method: 'POST', body: JSON.stringify(data) }),
  updateCommand: (id: string, data: { name?: string; duration?: number }) =>
    req<CommandItem>(`/api/commands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCommand: (id: string) => req<{ ok: boolean }>(`/api/commands/${id}`, { method: 'DELETE' }),
  addEdge: (data: { from: string; to: string; minDelay: number }) =>
    req<EdgeItem>('/api/edges', { method: 'POST', body: JSON.stringify(data) }),
  updateEdge: (id: string, data: { minDelay: number }) =>
    req<EdgeItem>(`/api/edges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEdge: (id: string) => req<{ ok: boolean }>(`/api/edges/${id}`, { method: 'DELETE' }),
};
