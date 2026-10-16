import { useEffect, useRef, useState } from 'react'
import { partitionDroppedPaths } from '../platform/droppedFiles'
import {
  tauriWindowFileDrop,
  type WindowFileDropClient,
} from '../platform/windowFileDrop'

type UseWindowFileDropOptions = {
  client?: WindowFileDropClient
  onImportImages: (files: File[]) => void
  onNotifyError: (error: unknown) => void
  onOpenMarkdownFile: (path: string) => void
}

/**
 * Opens documents and imports images dropped onto the window, and reports whether a drag is
 * currently hovering it.
 */
export function useWindowFileDrop({
  client = tauriWindowFileDrop,
  onImportImages,
  onNotifyError,
  onOpenMarkdownFile,
}: UseWindowFileDropOptions) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const handlersRef = useRef({ onImportImages, onNotifyError, onOpenMarkdownFile })

  useEffect(() => {
    handlersRef.current = { onImportImages, onNotifyError, onOpenMarkdownFile }
  })

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | null = null

    async function handleDrop(paths: string[]) {
      const { markdownPath, imagePaths } = partitionDroppedPaths(paths)
      if (markdownPath) {
        handlersRef.current.onOpenMarkdownFile(markdownPath)
        return
      }

      if (imagePaths.length === 0) {
        return
      }

      try {
        const files = await Promise.all(imagePaths.map((path) => client.readDroppedImage(path)))
        if (!disposed) {
          handlersRef.current.onImportImages(files)
        }
      } catch (error) {
        if (!disposed) {
          handlersRef.current.onNotifyError(error)
        }
      }
    }

    void client
      .listen({
        onDragStateChange: (isDragging) => {
          if (!disposed) {
            setIsDraggingFiles(isDragging)
          }
        },
        onDrop: (paths) => void handleDrop(paths),
      })
      .then((dispose) => {
        if (disposed) {
          dispose?.()
          return
        }

        unlisten = dispose
      })
      .catch((error: unknown) => {
        if (!disposed) {
          handlersRef.current.onNotifyError(error)
        }
      })

    return () => {
      disposed = true
      setIsDraggingFiles(false)
      unlisten?.()
    }
  }, [client])

  return { isDraggingFiles }
}
