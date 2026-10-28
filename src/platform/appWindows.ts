import { invoke } from '@tauri-apps/api/core'

export type AppWindowsClient = {
  /** Whether this runtime can open additional top-level windows. */
  supportsMultipleWindows: boolean
  /** Opens a new window, optionally loading a Markdown file into it. */
  openNewWindow: (path?: string) => Promise<void>
}

export const tauriAppWindows: AppWindowsClient = {
  supportsMultipleWindows: isTauriRuntime(),

  async openNewWindow(path) {
    if (!isTauriRuntime()) {
      return
    }

    await invoke('open_new_window', { path: path ?? null })
  },
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
