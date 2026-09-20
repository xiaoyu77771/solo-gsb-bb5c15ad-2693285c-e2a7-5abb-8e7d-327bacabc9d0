/** 时间显示：整数不带小数，否则保留 1 位 */
export function fmt(t: number): string {
  return `${Number.isInteger(t) ? t : t.toFixed(1)}s`;
}

export type RunState = 'pending' | 'running' | 'done';

export function runStateOf(entry: { start: number; end: number } | undefined, now: number): RunState {
  if (!entry) return 'pending';
  if (now >= entry.end) return 'done';
  if (now >= entry.start) return 'running';
  return 'pending';
}
