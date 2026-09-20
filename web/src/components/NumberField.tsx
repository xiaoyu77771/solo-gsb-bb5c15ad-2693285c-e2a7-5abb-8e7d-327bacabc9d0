import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  title?: string;
  min?: number;
  step?: number;
}

/**
 * 数字输入：聚焦期间保留原始输入文本（允许 "2." 这类中间态），
 * 仅在校验通过时实时提交；失焦后回显规范值。
 */
export default function NumberField({ value, onCommit, className, title, min = 0, step = 0.5 }: Props) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <input
      className={className}
      type="number"
      min={min}
      step={step}
      title={title}
      value={focused ? text : String(value)}
      onFocus={() => {
        setText(String(value));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min) {
          onCommit(n);
        }
      }}
    />
  );
}
