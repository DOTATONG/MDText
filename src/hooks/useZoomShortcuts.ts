import { useEffect, useEffectEvent, useMemo } from 'react'
import {
  detectShortcutPlatform,
  matchesShortcut,
  type ShortcutDefinition,
} from '../platform/keyboardShortcuts'

type UseZoomShortcutsOptions = {
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

/** `+` needs Shift on most layouts, while the numeric keypad sends it unshifted. */
const ZOOM_IN_SHORTCUTS: ShortcutDefinition[] = [
  { key: '=' },
  { key: '+' },
  { key: '+', shiftKey: true },
]

/**
 * Ctrl/Cmd with `-`, `+` and `0`, matching the zoom keys of a browser.
 *
 * `preventDefault` also stops the webview from treating these as page zoom.
 */
export function useZoomShortcuts(options: UseZoomShortcutsOptions) {
  const platform = useMemo(() => detectShortcutPlatform(), [])
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const isZoomIn = ZOOM_IN_SHORTCUTS.some(
      (shortcut) => matchesShortcut(event, shortcut, platform),
    )
    const isZoomOut = matchesShortcut(event, { key: '-' }, platform)
    const isZoomReset = matchesShortcut(event, { key: '0' }, platform)

    if (!isZoomIn && !isZoomOut && !isZoomReset) {
      return
    }

    event.preventDefault()

    if (isZoomIn) {
      options.onZoomIn()
      return
    }

    if (isZoomOut) {
      options.onZoomOut()
      return
    }

    options.onZoomReset()
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
