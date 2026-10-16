import { invoke } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'

export type WindowFileDropHandlers = {
  /** Fires while a drag hovers the window, so the drop hint can follow it. */
  onDragStateChange: (isDragging: boolean) => void
  /** Receives the absolute paths of every dropped file. */
  onDrop: (paths: string[]) => void
}

export type WindowFileDropClient = {
  listen: (handlers: WindowFileDropHandlers) => Promise<UnlistenFn | null>
  readDroppedImage: (path: string) => Promise<File>
}

type DroppedImageResponse = {
  name: string
  mimeType: string
  dataUrl: string
}

/**
 * Drag and drop of operating-system files onto the window.
 *
 * Tauri intercepts those drops before the webview sees them, so the events carry absolute paths
 * instead of `File` objects. That is what lets a dropped `.md` be opened as a real document with a
 * path, and the reason a dropped image is read back through the backend before it can be imported.
 */
export const tauriWindowFileDrop: WindowFileDropClient = {
  async listen({ onDragStateChange, onDrop }) {
    if (!isTauriRuntime()) {
      return null
    }

    return getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        onDragStateChange(false)
        if (event.payload.paths.length > 0) {
          onDrop(event.payload.paths)
        }
        return
      }

      onDragStateChange(event.payload.type !== 'leave')
    })
  },

  async readDroppedImage(path) {
    const dropped = await invoke<DroppedImageResponse>('read_dropped_image_file', { path })
    return new File([decodeBase64DataUrl(dropped.dataUrl)], dropped.name, { type: dropped.mimeType })
  },
}

/** The content security policy blocks fetching `data:` URLs, so the payload is decoded directly. */
function decodeBase64DataUrl(dataUrl: string): Uint8Array<ArrayBuffer> {
  const separator = dataUrl.indexOf(',')
  const binary = atob(separator === -1 ? dataUrl : dataUrl.slice(separator + 1))
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
