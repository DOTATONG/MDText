export type OpenLocalFile = (path: string) => Promise<void> | void

declare global {
  interface Window {
    __MDVIEW_OPEN_LOCAL_FILE__?: OpenLocalFile
  }
}

/**
 * Opens a local file with the operating system's default program. Only the
 * desktop app provides a handler; other builds report that it is unavailable.
 */
export async function openLocalFile(path: string): Promise<void> {
  if (!window.__MDVIEW_OPEN_LOCAL_FILE__) {
    throw new Error('Opening local files is only available in the desktop app.')
  }

  await window.__MDVIEW_OPEN_LOCAL_FILE__(path)
}
