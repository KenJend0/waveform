/**
 * Minimal transition store for shared element animation
 * Survives route changes via overlay
 * Observable via useSyncExternalStore for React 18 App Router compatibility
 */

export type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  fontSize?: string;
  fontWeight?: string;
};

export type TitleTransitionPayload = {
  label: string;
  from: Rect;
  to?: Rect;
  startedAt: number;
};

type Listener = () => void;

let payload: TitleTransitionPayload | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function setTitleTransition(p: TitleTransitionPayload) {
  payload = p;
  notify();
}

export function setTitleTransitionTo(to: Rect) {
  if (payload) {
    payload = { ...payload, to };
    notify();
  }
}

export function getTitleTransition() {
  return payload;
}

export function hasActiveTitleTransition() {
  return !!payload;
}

export function clearTitleTransition() {
  payload = null;
  notify();
}

/** Measure an element and register it as the transition target */
export function registerTransitionTarget(el: HTMLElement) {
  if (!payload) return;
  const rect = el.getBoundingClientRect();
  const computed = window.getComputedStyle(el);
  setTitleTransitionTo({
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    fontSize: computed.fontSize,
    fontWeight: computed.fontWeight,
  });
}

export function getSnapshot() {
  return !!payload;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
