import { afterEach, describe, expect, it, vi } from 'vitest'
import { printHtmlInBrowser } from './printHtml'

describe('browser HTML printing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.querySelectorAll('.marklite-print-root, .marklite-print-styles').forEach((element) => element.remove())
  })

  it('prints from the current window with the exported content and styles', async () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined)
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })

    await printHtmlInBrowser(
      '<!doctype html><html><head><style>.markdown-preview{color:red}</style></head><body><article class="markdown-preview">Ready</article></body></html>',
      'Ready',
    )

    expect(document.querySelector('.marklite-print-root')?.textContent).toBe('Ready')
    expect(document.querySelector('.marklite-print-styles')?.textContent).toContain('.markdown-preview{color:red}')
    expect(document.querySelector('.marklite-print-styles')?.textContent).toContain('content: "Ready"')
    expect(document.querySelector('.marklite-print-styles')?.textContent).toContain('content: counter(page)')
    expect(focus).toHaveBeenCalledOnce()
    expect(print).toHaveBeenCalledOnce()

    window.dispatchEvent(new Event('afterprint'))
    expect(document.querySelector('.marklite-print-root')).toBeNull()
    expect(document.querySelector('.marklite-print-styles')).toBeNull()
  })

  it('replaces an unfinished print layer before starting another print', async () => {
    vi.spyOn(window, 'focus').mockImplementation(() => undefined)
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })

    await printHtmlInBrowser('<body><article>First</article></body>', 'First')
    await printHtmlInBrowser('<body><article>Second</article></body>', 'Second')

    expect(document.querySelectorAll('.marklite-print-root')).toHaveLength(1)
    expect(document.querySelector('.marklite-print-root')?.textContent).toBe('Second')
  })
})
