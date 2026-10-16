import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { FileAccess, OpenedMarkdownFile } from './platform/fileAccess'
import type { WindowFileDropClient, WindowFileDropHandlers } from './platform/windowFileDrop'

describe('App window file drop', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('opens a Markdown document dropped onto the window', async () => {
    const openMarkdownFileAtPath = vi.fn(async (path: string) => file(path, '# Dropped document'))
    const drop = createWindowFileDrop()
    renderApp({
      fileAccess: createFileAccess({ openMarkdownFileAtPath }),
      windowFileDrop: drop.client,
    })

    await drop.fireDrop(['/tmp/dropped.md'])

    expect(openMarkdownFileAtPath).toHaveBeenCalledWith('/tmp/dropped.md')
    expect(await screen.findByRole('heading', { name: 'Dropped document' })).toBeInTheDocument()
  })

  it('copies a dropped image into the assets folder of the open document', async () => {
    const writeImageAsset = vi.fn<FileAccess['writeImageAsset']>(async () => ({
      path: '/tmp/assets/photo.png',
      relativePath: 'assets/photo.png',
      filename: 'photo.png',
    }))
    const drop = createWindowFileDrop()
    renderApp({ fileAccess: createFileAccess({ writeImageAsset }), windowFileDrop: drop.client })

    await drop.fireDrop(['/tmp/photo.png'])

    await waitFor(() => expect(writeImageAsset).toHaveBeenCalledTimes(1))
    expect(writeImageAsset.mock.calls[0][1]).toMatchObject({
      fileName: 'photo.png',
      mimeType: 'image/png',
    })
    expect(await screen.findByText('1 image imported.')).toBeInTheDocument()
  })

  it('shows a drop hint while a file hovers the window', async () => {
    const drop = createWindowFileDrop()
    renderApp({ fileAccess: createFileAccess(), windowFileDrop: drop.client })

    await drop.setDragging(true)
    expect(
      screen.getByText('Drop to open the Markdown file, or drop images to insert them'),
    ).toBeInTheDocument()

    await drop.setDragging(false)
    expect(
      screen.queryByText('Drop to open the Markdown file, or drop images to insert them'),
    ).not.toBeInTheDocument()
  })

  it('keeps the current document when the dropped file is not supported', async () => {
    const openMarkdownFileAtPath = vi.fn(async (path: string) => file(path, '# Dropped'))
    const drop = createWindowFileDrop()
    renderApp({
      fileAccess: createFileAccess({ openMarkdownFileAtPath }),
      windowFileDrop: drop.client,
    })

    await drop.fireDrop(['/tmp/archive.zip'])

    expect(openMarkdownFileAtPath).not.toHaveBeenCalled()
  })
})

type WindowFileDropHarness = {
  client: WindowFileDropClient
  fireDrop: (paths: string[]) => Promise<void>
  setDragging: (isDragging: boolean) => Promise<void>
}

function createWindowFileDrop(): WindowFileDropHarness {
  const state: { handlers: WindowFileDropHandlers | null } = { handlers: null }
  const client: WindowFileDropClient = {
    listen: vi.fn(async (handlers: WindowFileDropHandlers) => {
      state.handlers = handlers
      return () => undefined
    }),
    readDroppedImage: vi.fn(async (path: string) =>
      new File(['image'], path.split('/').at(-1) ?? 'image.png', { type: 'image/png' }),
    ),
  }

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
    client,
    fireDrop: (paths) => withHandlers((handlers) => handlers.onDrop(paths)),
    setDragging: (isDragging) =>
      withHandlers((handlers) => handlers.onDragStateChange(isDragging)),
  }
}

function renderApp(props: ComponentProps<typeof App>) {
  const result = render(<App {...props} initialLanguage="en" />)
  fireEvent.click(screen.getByRole('button', { name: /Create new markdown file/ }))
  return result
}

function file(path: string, content: string): OpenedMarkdownFile {
  return { path, content }
}

function createFileAccess(
  overrides: {
    openMarkdownFileAtPath?: FileAccess['openMarkdownFileAtPath']
    writeImageAsset?: FileAccess['writeImageAsset']
  } = {},
): FileAccess {
  return {
    supportsNativeFiles: true,
    supportsImageImport: true,
    docxImport: undefined,
    openMarkdownFile: vi.fn(async () => null),
    openMarkdownFileAtPath:
      overrides.openMarkdownFileAtPath ?? vi.fn(async (path) => file(path, '# Dropped')),
    revealFileInFolder: vi.fn(async () => undefined),
    saveMarkdownFile: vi.fn(async (path) => path),
    saveMarkdownFileAs: vi.fn(async () => '/tmp/saved-as.md'),
    exportHtmlFile: vi.fn(async () => '/tmp/export.html'),
    exportDocxFile: vi.fn(async () => '/tmp/export.docx'),
    printExportHtml: vi.fn(async () => undefined),
    readLocalImageFile: vi.fn(async (path) => ({ path, dataUrl: 'data:image/png;base64,test' })),
    writeImageAsset:
      overrides.writeImageAsset ??
      vi.fn(async () => ({
        path: '/tmp/assets/image.png',
        relativePath: 'assets/image.png',
        filename: 'image.png',
      })),
    readStartupMarkdownFile: vi.fn(async () => null),
    listenForOpenedFiles: vi.fn(async () => null),
  }
}
