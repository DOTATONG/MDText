import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    })
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: ['en-US'],
    })

    const selectedPath = 'C:\\Docs\\E2E Opened.md'
    const droppedPath = 'C:\\Docs\\E2E Dropped.md'
    const files: Record<string, string> = {
      [selectedPath]: '# E2E Opened\n\nThis file was loaded by Playwright.\n',
      [droppedPath]: '# E2E Dropped\n\nThis file was dragged into the window.\n',
    }
    type DropHandlers = {
      onDragStateChange: (isDragging: boolean) => void
      onDrop: (paths: string[]) => void
    }
    const state = {
      savedContent: null as string | null,
      savedPath: null as string | null,
      dropHandlers: null as DropHandlers | null,
    }
    const win = window as typeof window & {
      __MDVIEW_E2E_FILE_ACCESS__?: unknown
      __MDVIEW_E2E_WINDOW_FILE_DROP__?: unknown
      __MDVIEW_E2E_STATE__?: typeof state
    }

    localStorage.clear()
    if (new URLSearchParams(window.location.search).get('e2eDraft') === 'recover') {
      localStorage.setItem('mdview.documentDraft.v1', JSON.stringify({
        id: 'e2e-draft',
        path: null,
        title: 'Untitled.md',
        content: '# Recovered draft\n\nRestored by Playwright.',
        updatedAt: Date.now(),
      }))
    }
    win.__MDVIEW_E2E_STATE__ = state
    win.__MDVIEW_E2E_FILE_ACCESS__ = {
      supportsNativeFiles: true,
      openMarkdownFile: async () => ({
        path: selectedPath,
        content: files[selectedPath],
      }),
      openMarkdownFileAtPath: async (path: string) => {
        const content = files[path]
        if (content === undefined) {
          throw new Error(`Missing test file: ${path}`)
        }

        return { path, content }
      },
      saveMarkdownFile: async (path: string, content: string) => {
        state.savedPath = path
        state.savedContent = content
        files[path] = content
        return path
      },
      saveMarkdownFileAs: async (content: string) => {
        const path = 'C:\\Docs\\Saved As.md'
        state.savedPath = path
        state.savedContent = content
        files[path] = content
        return path
      },
      exportHtmlFile: async () => 'C:\\Docs\\Exported.html',
      printExportHtml: async () => undefined,
      readLocalImageFile: async (path: string) => ({
        path,
        dataUrl: 'data:image/png;base64,',
      }),
      readStartupMarkdownFile: async () => null,
      listenForOpenedFiles: async () => null,
    }
    win.__MDVIEW_E2E_WINDOW_FILE_DROP__ = {
      listen: async (handlers: DropHandlers) => {
        state.dropHandlers = handlers
        return () => undefined
      },
      readDroppedImage: async (path: string) =>
        new File(['image'], path.split(/[\\/]/).pop() ?? 'image.png', { type: 'image/png' }),
    }
  })

  await page.goto('/')
})

test('starts from a welcome workspace and creates a new document', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Open a Markdown file' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Markdown File' })).toBeEnabled()
  await expect(page.getByText('No recent files')).toBeVisible()
  await expect(page.getByLabel('View mode')).toHaveCount(0)

  await page.getByRole('button', { name: 'Create new markdown file' }).click()

  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit markdown source' })).toHaveClass(/active/)
})

test('opens a markdown file through the file menu', async ({ page }) => {
  await openMarkdownFile(page)

  await expect(page.getByRole('heading', { level: 1, name: 'E2E Opened' })).toBeVisible()
  await expect(page.getByText('E2E Opened.md', { exact: true })).toBeVisible()
})

test('opens a markdown document dropped onto the window', async ({ page }) => {
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __MDVIEW_E2E_STATE__?: { dropHandlers?: unknown } })
      .__MDVIEW_E2E_STATE__?.dropHandlers),
  )

  await page.evaluate(() => {
    const state = (window as unknown as {
      __MDVIEW_E2E_STATE__?: { dropHandlers?: { onDrop: (paths: string[]) => void } }
    }).__MDVIEW_E2E_STATE__
    state?.dropHandlers?.onDrop(['C:\\Docs\\E2E Dropped.md'])
  })

  await expect(page.getByRole('heading', { level: 1, name: 'E2E Dropped' })).toBeVisible()
  await expect(page.getByText('E2E Dropped.md', { exact: true })).toBeVisible()
})

test('saves edited markdown content', async ({ page }) => {
  await openMarkdownFile(page)
  await page.getByRole('button', { name: 'Edit markdown source' }).click()

  await page
    .getByRole('textbox', { name: 'Markdown source' })
    .fill('# Saved from E2E\n\nUpdated by Playwright.\n')
  await page.getByRole('button', { exact: true, name: 'File' }).click()
  await page.getByRole('menuitem', { exact: true, name: 'Save' }).click()

  await expect(page.locator('.editor-save-state')).toHaveText('Saved')
  await expect
    .poll(() => getSavedContent(page))
    .toContain('# Saved from E2E')
})

test('switches the interface language from the App menu', async ({ page }) => {
  await page.getByRole('button', { name: 'App' }).click()
  await page.getByRole('menuitem', { name: '中文' }).click()

  await expect(page.getByRole('button', { exact: true, name: '文件' })).toBeVisible()

  await page.getByRole('button', { name: '应用' }).click()
  await expect(page.getByText('界面语言')).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '关于' })).toBeVisible()
})

test('opens the About dialog from the App menu', async ({ page }) => {
  await page.getByRole('button', { name: 'App' }).click()
  await page.getByRole('menuitem', { name: 'About' }).click()

  await expect(page.getByRole('dialog', { name: 'About MDView' })).toBeVisible()
  await expect(page.getByText(/^Version [0-9]+\.[0-9]+\.[0-9]+$/)).toBeVisible()
})

test('synchronizes split editor and preview scrolling in both directions', async ({ page }) => {
  await page.getByRole('button', { name: 'Create new markdown file' }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown source' })
  const content = Array.from({ length: 80 }, (_, index) => (
    `## Section ${index + 1}\n\nThis is enough content to create a readable preview block.\n`
  )).join('\n')
  await editor.fill(content)
  await page.getByRole('button', { name: 'Split preview and source' }).click()

  const preview = page.getByLabel('Preview panel')
  await expect(preview.locator('[data-mdview-source-start]').first()).toBeVisible()

  await editor.evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2
    element.dispatchEvent(new Event('scroll'))
  })
  await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBeGreaterThan(100)

  await editor.evaluate((element) => {
    element.scrollTop = 0
  })
  await preview.evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2
    element.dispatchEvent(new Event('scroll'))
  })
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(100)

  await page.getByRole('button', { name: 'Disable synchronized scrolling' }).click()
  const previewTopBeforeDisable = await preview.evaluate((element) => element.scrollTop)
  await editor.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await page.waitForTimeout(100)
  await expect.poll(() => preview.evaluate((element) => element.scrollTop)).toBe(previewTopBeforeDisable)
})

test('aligns wrapped Chinese paragraphs with the same preview heading', async ({ page }) => {
  await page.getByRole('button', { name: 'Create new markdown file' }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown source' })
  await editor.fill(Array.from({ length: 40 }, (_, i) => `## Section ${i + 1}\n\n${'这是一段用于验证自动换行后的同步滚动位置的长正文。'.repeat(18)}\n`).join('\n'))
  await page.getByRole('button', { name: 'Split preview and source' }).click()
  const preview = page.getByLabel('Preview panel')
  const heading = preview.getByRole('heading', { name: 'Section 20', exact: true })
  await expect(heading).toBeAttached()
  const editorTop = await editor.evaluate(async element => {
    const modulePath = '/src/domain/editorLinePositions.ts'
    const { measureEditorLinePositions } = await import(modulePath)
    const textarea = element as HTMLTextAreaElement
    const line = textarea.value.split('\n').findIndex(value => value === '## Section 20')
    return measureEditorLinePositions(textarea)[line]
  })
  await editor.evaluate((element, top) => { element.scrollTop = top }, editorTop)
  await expect.poll(() => heading.evaluate(element => {
    const panel = element.closest('[aria-label="Preview panel"]')!
    return Math.abs(element.getBoundingClientRect().top - panel.getBoundingClientRect().top)
  })).toBeLessThan(4)
  await preview.evaluate(element => { element.scrollTop = 0 })
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBe(0)
  await heading.evaluate(element => {
    const panel = element.closest('[aria-label="Preview panel"]')!
    panel.scrollTop += element.getBoundingClientRect().top - panel.getBoundingClientRect().top
  })
  await expect.poll(() => editor.evaluate((element, top) => Math.abs(element.scrollTop - top), editorTop)).toBeLessThan(4)
})

test('recalibrates split scrolling inside wrapped paragraphs when content width changes', async ({ page }) => {
  await page.setViewportSize({ width: 2800, height: 1000 })
  await page.getByRole('button', { name: 'Create new markdown file' }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown source' })
  await editor.fill(Array.from({ length: 40 }, (_, i) => (
    `## Section ${i + 1}\n\n${'A long paragraph with enough words to wrap differently at each reading width. '.repeat(24)}\n`
  )).join('\n'))
  await page.getByRole('button', { name: 'Split preview and source' }).click()
  const preview = page.getByLabel('Preview panel')
  const paragraph = preview.locator('p[data-mdview-source-start="39"]')
  await expect(paragraph).toBeAttached()

  const [start, end] = await editor.evaluate(async element => {
    const modulePath = '/src/domain/editorLinePositions.ts'
    const { measureEditorLinePositions } = await import(modulePath)
    const tops = measureEditorLinePositions(element as HTMLTextAreaElement)
    return [tops[38], tops[39]]
  })
  const editorMidpoint = (start + end) / 2
  await editor.evaluate((element, top) => { element.scrollTop = top }, editorMidpoint)

  for (const width of [940, 680, 1180]) {
    await page.evaluate(value => {
      document.documentElement.style.setProperty('--reader-content-width', `${value}px`)
    }, width)
    await expect.poll(() => preview.locator('.markdown-preview').evaluate(element => (
      element.getBoundingClientRect().width
    ))).toBe(width)
    await expect.poll(() => paragraph.evaluate(element => {
      const panel = element.closest('[aria-label="Preview panel"]')!
      const rect = element.getBoundingClientRect()
      return Math.abs(rect.top + rect.height / 2 - panel.getBoundingClientRect().top)
    })).toBeLessThan(4)

    await paragraph.evaluate(element => {
      const panel = element.closest('[aria-label="Preview panel"]')!
      const rect = element.getBoundingClientRect()
      panel.scrollTop += rect.top + rect.height / 4 - panel.getBoundingClientRect().top
    })
    await expect.poll(() => editor.evaluate((element, top) => Math.abs(element.scrollTop - top),
      start + (end - start) / 4)).toBeLessThan(4)

    await editor.evaluate((element, top) => { element.scrollTop = top }, editorMidpoint)
    await expect.poll(() => paragraph.evaluate(element => {
      const panel = element.closest('[aria-label="Preview panel"]')!
      const rect = element.getBoundingClientRect()
      return Math.abs(rect.top + rect.height / 2 - panel.getBoundingClientRect().top)
    })).toBeLessThan(4)
  }
})

test('restores a pending unsaved draft', async ({ page }) => {
  await page.goto('/?e2eDraft=recover')

  await expect(page.getByRole('dialog', { name: 'Recover unsaved draft' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore draft' }).click()

  await expect(page.getByRole('textbox', { name: 'Markdown source' })).toHaveValue(
    '# Recovered draft\n\nRestored by Playwright.',
  )
  await expect(page.locator('.editor-save-state')).toHaveText('Unsaved')
})

test('zooming the interface keeps the shell filling the window', async ({ page }) => {
  await zoomTo(page, 8)
  const largest = await readLayout(page)
  expect(largest.zoom).toBe('2')

  await zoomTo(page, -12)
  const smallest = await readLayout(page)
  expect(smallest.zoom).toBe('0.8')

  for (const layout of [largest, smallest]) {
    expect(Math.abs(layout.shellHeight - layout.innerHeight)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.shellWidth - layout.innerWidth)).toBeLessThanOrEqual(1)
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight)
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
  }
})

test('keeps the settings dialog inside the window at maximum zoom', async ({ page }) => {
  await zoomTo(page, 8)

  await page.getByRole('button', { name: 'App' }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()

  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()

  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (!box || !viewport) {
    return
  }

  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
})

async function openMarkdownFile(page: Page) {
  await page.getByRole('button', { exact: true, name: 'File' }).click()
  await page.getByRole('menuitem', { name: 'Open Markdown File' }).click()
}


async function zoomTo(page: Page, steps: number) {
  for (let step = 0; step < Math.abs(steps); step += 1) {
    await page.keyboard.press(steps > 0 ? 'Control+=' : 'Control+-')
  }
}

async function readLayout(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.app-shell')?.getBoundingClientRect()
    return {
      shellHeight: shell?.height ?? 0,
      shellWidth: shell?.width ?? 0,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      zoom: document.documentElement.style.getPropertyValue('--ui-zoom'),
    }
  })
}

async function getSavedContent(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const win = window as typeof window & {
      __MDVIEW_E2E_STATE__?: {
        savedContent: string | null
      }
    }

    return win.__MDVIEW_E2E_STATE__?.savedContent ?? null
  })
}
