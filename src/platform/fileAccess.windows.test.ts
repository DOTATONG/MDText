import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
const listen = vi.fn()
const getCurrentWindow = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ invoke }))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow,
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ listen }),
}))

vi.mock('./printHtml', () => ({
  printHtmlInBrowser: vi.fn(),
}))

describe('file access window routing', () => {
  beforeEach(() => {
    invoke.mockReset()
    listen.mockReset()
    getCurrentWindow.mockReset()
    window.history.replaceState(null, '', '/')

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
  })

  it('loads the file a newly created window was asked to show', async () => {
    window.history.replaceState(null, '', '/index.html?file=C%3A%5CDocs%5Cnew.md')
    getCurrentWindow.mockReturnValue({ label: 'window-1' })
    invoke.mockResolvedValueOnce({ path: 'C:\\Docs\\new.md', content: '# New' })
    const { tauriFileAccess } = await import('./fileAccess')

    await expect(tauriFileAccess.readStartupMarkdownFile()).resolves.toMatchObject({
      path: 'C:\\Docs\\new.md',
    })
    expect(invoke).toHaveBeenCalledWith('open_markdown_file_at_path', {
      path: 'C:\\Docs\\new.md',
    })
  })

  it('does not consume command-line files from a secondary window', async () => {
    getCurrentWindow.mockReturnValue({ label: 'window-1' })
    const { tauriFileAccess } = await import('./fileAccess')

    await expect(tauriFileAccess.readStartupMarkdownFile()).resolves.toBeNull()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('lets the main window take command-line files', async () => {
    getCurrentWindow.mockReturnValue({ label: 'main' })
    invoke.mockResolvedValueOnce([])
    const { tauriFileAccess } = await import('./fileAccess')

    await expect(tauriFileAccess.readStartupMarkdownFile()).resolves.toBeNull()
    expect(invoke).toHaveBeenCalledWith('take_opened_files')
  })

  it('passes every path in an opened-files event to the callback', async () => {
    const unlisten = vi.fn()
    let handler: ((event: { payload: string[] }) => void) | undefined
    listen.mockImplementation(async (_event: string, callback: typeof handler) => {
      handler = callback
      return unlisten
    })
    const callback = vi.fn()
    const { tauriFileAccess } = await import('./fileAccess')

    await expect(tauriFileAccess.listenForOpenedFiles(callback)).resolves.toBe(unlisten)

    handler?.({ payload: ['C:\\Docs\\a.md', 'C:\\Docs\\b.md'] })

    expect(callback).toHaveBeenCalledWith(['C:\\Docs\\a.md', 'C:\\Docs\\b.md'])
  })
})
