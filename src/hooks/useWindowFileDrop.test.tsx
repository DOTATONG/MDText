import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WindowFileDropClient, WindowFileDropHandlers } from '../platform/windowFileDrop'
import { useWindowFileDrop } from './useWindowFileDrop'

describe('useWindowFileDrop', () => {
  it('opens a dropped Markdown document', async () => {
    const drop = setupDrop()

    await drop.fireDrop(['C:\\docs\\readme.md'])

    expect(drop.onOpenMarkdownFile).toHaveBeenCalledWith('C:\\docs\\readme.md')
    expect(drop.readDroppedImage).not.toHaveBeenCalled()
  })

  it('imports a dropped image as a file the editor can copy', async () => {
    const drop = setupDrop()

    await drop.fireDrop(['/tmp/photo.png'])

    await waitFor(() => expect(drop.onImportImages).toHaveBeenCalledTimes(1))
    const [files] = drop.onImportImages.mock.calls[0]
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('photo.png')
    expect(drop.onOpenMarkdownFile).not.toHaveBeenCalled()
  })

  it('opens the document when a document and images are dropped together', async () => {
    const drop = setupDrop()

    await drop.fireDrop(['/tmp/photo.png', '/tmp/notes.md'])

    expect(drop.onOpenMarkdownFile).toHaveBeenCalledWith('/tmp/notes.md')
    expect(drop.readDroppedImage).not.toHaveBeenCalled()
  })

  it('ignores a drop of unsupported files', async () => {
    const drop = setupDrop()

    await drop.fireDrop(['/tmp/archive.zip'])

    expect(drop.onOpenMarkdownFile).not.toHaveBeenCalled()
    expect(drop.onImportImages).not.toHaveBeenCalled()
  })

  it('reports an image that cannot be read', async () => {
    const drop = setupDrop()
    const failure = new Error('Image files must be 10 MB or smaller.')
    drop.readDroppedImage.mockRejectedValueOnce(failure)

    await drop.fireDrop(['/tmp/huge.png'])

    await waitFor(() => expect(drop.onNotifyError).toHaveBeenCalledWith(failure))
    expect(drop.onImportImages).not.toHaveBeenCalled()
  })

  it('tracks the drag state while a file hovers the window', async () => {
    const drop = setupDrop()
    expect(drop.result.current.isDraggingFiles).toBe(false)

    await drop.setDragging(true)
    expect(drop.result.current.isDraggingFiles).toBe(true)

    await drop.setDragging(false)
    expect(drop.result.current.isDraggingFiles).toBe(false)
  })

  it('stops listening when the view unmounts', async () => {
    const drop = setupDrop()
    await drop.waitForListener()

    drop.unmount()

    expect(drop.unlisten).toHaveBeenCalled()
  })

  it('still releases the listener when the view unmounts while listening starts', async () => {
    const drop = setupDrop()

    drop.unmount()

    await waitFor(() => expect(drop.unlisten).toHaveBeenCalled())
  })

  it('reports a listener that could not be registered', async () => {
    const failure = new Error('Drag and drop is unavailable.')
    const drop = setupDrop({ listenFailure: failure })

    await waitFor(() => expect(drop.onNotifyError).toHaveBeenCalledWith(failure))
  })
})

type SetupOptions = {
  listenFailure?: Error
}

function setupDrop({ listenFailure }: SetupOptions = {}) {
  const state: { handlers: WindowFileDropHandlers | null } = { handlers: null }
  const unlisten = vi.fn()
  const readDroppedImage = vi.fn(async (path: string) =>
    new File(['image'], fileNameOf(path), { type: 'image/png' }),
  )
  const client: WindowFileDropClient = {
    listen: vi.fn(async (handlers: WindowFileDropHandlers) => {
      if (listenFailure) {
        throw listenFailure
      }
      state.handlers = handlers
      return unlisten
    }),
    readDroppedImage,
  }
  const onImportImages = vi.fn()
  const onNotifyError = vi.fn()
  const onOpenMarkdownFile = vi.fn()
  const view = renderHook(() =>
    useWindowFileDrop({ client, onImportImages, onNotifyError, onOpenMarkdownFile }),
  )

  async function withHandlers(run: (handlers: WindowFileDropHandlers) => void) {
    await waitFor(() => expect(state.handlers).not.toBeNull())
    const handlers = state.handlers
    if (!handlers) {
      throw new Error('The drop listener was not registered.')
    }
    await act(async () => {
      run(handlers)
    })
  }

  return {
    ...view,
    client,
    onImportImages,
    onNotifyError,
    onOpenMarkdownFile,
    readDroppedImage,
    unlisten,
    fireDrop: (paths: string[]) => withHandlers((handlers) => handlers.onDrop(paths)),
    setDragging: (isDragging: boolean) =>
      withHandlers((handlers) => handlers.onDragStateChange(isDragging)),
    waitForListener: () => waitFor(() => expect(state.handlers).not.toBeNull()),
  }
}

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? 'image.png'
}
