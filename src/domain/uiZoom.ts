export type UiZoomDirection = 'in' | 'out'

export const UI_ZOOM_STORAGE_KEY = 'mdview.uiZoom.v1'
export const DEFAULT_UI_ZOOM = 1

/** Discrete stops, close to the ladder a browser offers for page zoom. */
export const UI_ZOOM_LEVELS: number[] = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

export function loadUiZoom(storage: Storage | null = getLocalStorage()): number {
  if (!storage) {
    return DEFAULT_UI_ZOOM
  }

  const rawValue = storage.getItem(UI_ZOOM_STORAGE_KEY)
  if (rawValue === null) {
    return DEFAULT_UI_ZOOM
  }

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? clampUiZoom(parsed) : DEFAULT_UI_ZOOM
}

export function saveUiZoom(zoom: number, storage: Storage | null = getLocalStorage()) {
  storage?.setItem(UI_ZOOM_STORAGE_KEY, String(clampUiZoom(zoom)))
}

/** Snaps to the nearest stop, so a hand-edited or future value still lands on the ladder. */
export function clampUiZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return DEFAULT_UI_ZOOM
  }

  return UI_ZOOM_LEVELS.reduce((closest, level) =>
    Math.abs(level - zoom) < Math.abs(closest - zoom) ? level : closest)
}

/** Returns the current zoom unchanged when the ladder has been exhausted. */
export function stepUiZoom(zoom: number, direction: UiZoomDirection): number {
  const current = clampUiZoom(zoom)
  const offset = direction === 'in' ? 1 : -1
  const nextIndex = UI_ZOOM_LEVELS.indexOf(current) + offset

  return UI_ZOOM_LEVELS[Math.min(Math.max(nextIndex, 0), UI_ZOOM_LEVELS.length - 1)]
}

export function canStepUiZoom(zoom: number, direction: UiZoomDirection): boolean {
  return stepUiZoom(zoom, direction) !== clampUiZoom(zoom)
}

export function isDefaultUiZoom(zoom: number): boolean {
  return clampUiZoom(zoom) === DEFAULT_UI_ZOOM
}

export function formatUiZoom(zoom: number): string {
  return `${Math.round(clampUiZoom(zoom) * 100)}%`
}

function getLocalStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}
