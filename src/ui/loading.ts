import { el, show } from './dom';

/** The loading screen (mock-up frame 0). Returns a setter for the bar, 0 to 1. */
export function showLoading(): (progress: number) => void {
  const fill = el('i');
  show(
    el('div', { className: 'screen', testId: 'loading' },
      el('div', { className: 'top' }, el('span', { text: 'Artifice' })),
      el('div', { className: 'loading' }, el('p', { text: 'Lighting the forge…' }), el('div', { className: 'loadbar' }, fill)),
    ),
  );
  return (p) => {
    fill.style.width = `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;
  };
}
