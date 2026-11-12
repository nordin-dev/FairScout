import { useEffect, useRef, useState } from 'react';
import './Tooltip.css';

type Tip = { text: string; x: number; y: number } | null;

const OFFSET_X = 14;
const OFFSET_Y = 16;
const MARGIN = 12;

/**
 * The dark tooltip. Mount it once; it shows the `data-tip` text of the element under the
 * pointer or holding keyboard focus.
 */
export function Tooltip() {
  const [tip, setTip] = useState<Tip>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tip]') : null);
    const width = () => box.current?.offsetWidth ?? 0;
    const onMove = (e: MouseEvent) => {
      const el = target(e);
      if (!el) return setTip(null);
      const x = Math.min(e.clientX + OFFSET_X, window.innerWidth - width() - MARGIN);
      setTip({ text: el.dataset.tip ?? '', x, y: e.clientY + OFFSET_Y });
    };
    const onFocus = (e: FocusEvent) => {
      const el = target(e);
      if (!el) return setTip(null);
      const r = el.getBoundingClientRect();
      const x = Math.min(r.left, window.innerWidth - width() - MARGIN);
      setTip({ text: el.dataset.tip ?? '', x, y: r.bottom + 6 });
    };
    const hide = () => setTip(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
    };
  }, []);

  return (
    <div
      id="tip"
      ref={box}
      role="tooltip"
      style={{ left: tip?.x ?? 0, top: tip?.y ?? 0, opacity: tip ? 1 : 0 }}
    >
      {tip?.text}
    </div>
  );
}
