/** Small helpers for the DOM overlay panels that sit over the canvas (forge spec, Scale and screen). */
export function uiRoot(): HTMLElement {
  const el = document.getElementById('ui');
  if (!el) throw new Error('#ui is missing from index.html');
  return el;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; testId?: string; attrs?: Record<string, string> } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.testId) node.dataset.testid = props.testId;
  for (const [k, v] of Object.entries(props.attrs ?? {})) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

/** Replace everything in the overlay with one screen. */
export function show(screen: HTMLElement): void {
  uiRoot().replaceChildren(screen);
}
