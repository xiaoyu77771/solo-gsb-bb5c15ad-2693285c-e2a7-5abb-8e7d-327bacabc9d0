/** 口令节点：一次舞台换景口令，含持续时长（秒） */
export interface CommandItem {
  id: string;
  name: string;
  duration: number;
}

/** 依赖边：前置口令完成后至少等待 minDelay 秒，后续口令方可开始 */
export interface EdgeItem {
  id: string;
  from: string;
  to: string;
  minDelay: number;
}

export interface Graph {
  commands: CommandItem[];
  edges: EdgeItem[];
}

export type SimStatus = 'idle' | 'running' | 'paused' | 'finished';
