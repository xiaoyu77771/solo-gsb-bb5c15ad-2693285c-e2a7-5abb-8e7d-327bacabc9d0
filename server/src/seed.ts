import { Graph } from './types';

/** 首次启动时的示例口令图（一次完整的舞台换景流程） */
export function seedGraph(): Graph {
  return {
    commands: [
      { id: 'c-light-dim', name: '灯光渐暗', duration: 3 },
      { id: 'c-curtain-close', name: '幕布闭合', duration: 4 },
      { id: 'c-strike-old', name: '撤场·旧布景', duration: 8 },
      { id: 'c-props', name: '道具定位', duration: 5 },
      { id: 'c-bring-new', name: '进场·新布景', duration: 10 },
      { id: 'c-actors', name: '演员就位', duration: 4 },
      { id: 'c-curtain-open', name: '幕布开启', duration: 4 },
      { id: 'c-light-up', name: '灯光亮起', duration: 3 },
    ],
    edges: [
      { id: 'e1', from: 'c-light-dim', to: 'c-curtain-close', minDelay: 1 },
      { id: 'e2', from: 'c-curtain-close', to: 'c-strike-old', minDelay: 2 },
      { id: 'e3', from: 'c-curtain-close', to: 'c-props', minDelay: 0 },
      { id: 'e4', from: 'c-strike-old', to: 'c-bring-new', minDelay: 1 },
      { id: 'e5', from: 'c-bring-new', to: 'c-actors', minDelay: 2 },
      { id: 'e6', from: 'c-props', to: 'c-actors', minDelay: 1 },
      { id: 'e7', from: 'c-actors', to: 'c-curtain-open', minDelay: 0 },
      { id: 'e8', from: 'c-curtain-open', to: 'c-light-up', minDelay: 1 },
      { id: 'e9', from: 'c-actors', to: 'c-light-up', minDelay: 2 },
    ],
  };
}
