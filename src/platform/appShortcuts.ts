import {
  formatShortcut,
  formatShortcutAria,
  type ShortcutDefinition,
  type ShortcutPlatform,
} from './keyboardShortcuts'

/**
 * Shortcuts that are both handled globally and advertised in the app menus.
 * Keeping them here means the handler's binding and the displayed hint cannot drift.
 */
export const APP_SHORTCUTS = {
  close: { key: 'w' },
  new: { key: 'n' },
  open: { key: 'o' },
  save: { key: 's' },
  saveAs: { key: 's', shiftKey: true },
  zoomIn: { key: '=' },
  zoomOut: { key: '-' },
  zoomReset: { key: '0' },
} satisfies Record<string, ShortcutDefinition>

export type AppShortcutId = keyof typeof APP_SHORTCUTS

export type ShortcutHint = {
  /** Short label shown at the end of a menu item, e.g. `Ctrl+Shift+S`. */
  label: string
  /** Value for `aria-keyshortcuts`, e.g. `Control+Shift+S`. */
  aria: string
}

export type AppShortcutHints = Record<AppShortcutId, ShortcutHint>

export function createAppShortcutHints(platform: ShortcutPlatform): AppShortcutHints {
  return Object.fromEntries(
    Object.entries(APP_SHORTCUTS).map(([id, shortcut]) => [
      id,
      {
        label: formatShortcut(shortcut, platform),
        aria: formatShortcutAria(shortcut, platform),
      },
    ]),
  ) as AppShortcutHints
}
