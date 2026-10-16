import { clampUiZoom } from '../domain/uiZoom'

/**
 * Interface zoom is applied as a CSS variable instead of a native webview zoom, so the desktop
 * app, the browser build and the Edge extension all scale identically.
 *
 * `.app-shell` scales itself by this factor and divides its own size by it: `scale()` does not
 * affect viewport units or percentages, so an unscaled shell would overflow the window.
 */
export function applyUiZoom(zoom: number) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.style.setProperty('--ui-zoom', String(clampUiZoom(zoom)))
}
