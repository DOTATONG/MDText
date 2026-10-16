import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadReadingPreferences, resolveEffectiveReadingTheme } from './domain/readingPreferences.ts'
import type { FileAccess } from './platform/fileAccess.ts'
import { tauriFileAccess } from './platform/fileAccess.ts'
import type { WindowFileDropClient } from './platform/windowFileDrop.ts'
import { tauriWindowFileDrop } from './platform/windowFileDrop.ts'
import { tauriAppUpdateClient } from './platform/appUpdates.ts'
import { bootstrapReadingTheme } from './platform/readingTheme.ts'
import { setTheme } from '@tauri-apps/api/app'
import { openUrl } from '@tauri-apps/plugin-opener'
import { createTauriWindowFrame } from './platform/tauriWindowFrame.ts'
import { nativeWindowFrame } from './platform/windowFrame.ts'

declare global {
  interface Window {
    __MDVIEW_E2E_FILE_ACCESS__?: FileAccess
    __MDVIEW_E2E_WINDOW_FILE_DROP__?: WindowFileDropClient
  }
}

bootstrapReadingTheme(loadReadingPreferences, (preferences, systemTheme) =>
  resolveEffectiveReadingTheme(preferences.themeMode, systemTheme),
)

window.__MDVIEW_SYNC_NATIVE_THEME__ = setTheme
window.__MDVIEW_OPEN_EXTERNAL_LINK__ = openUrl

const windowFrame = '__TAURI_INTERNALS__' in window
  ? createTauriWindowFrame()
  : nativeWindowFrame

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      appUpdateClient={tauriAppUpdateClient}
      fileAccess={window.__MDVIEW_E2E_FILE_ACCESS__ ?? tauriFileAccess}
      windowFileDrop={window.__MDVIEW_E2E_WINDOW_FILE_DROP__ ?? tauriWindowFileDrop}
      windowFrame={windowFrame}
    />
  </StrictMode>,
)
