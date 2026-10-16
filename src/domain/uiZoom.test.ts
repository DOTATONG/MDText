import { describe, expect, it } from 'vitest'
import {
  canStepUiZoom,
  clampUiZoom,
  DEFAULT_UI_ZOOM,
  formatUiZoom,
  isDefaultUiZoom,
  loadUiZoom,
  saveUiZoom,
  stepUiZoom,
  UI_ZOOM_LEVELS,
  UI_ZOOM_STORAGE_KEY,
} from './uiZoom'

function createStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('uiZoom', () => {
  it('walks the ladder one stop at a time', () => {
    expect(stepUiZoom(1, 'in')).toBe(1.1)
    expect(stepUiZoom(1, 'out')).toBe(0.9)
  })

  it('stops at both ends of the ladder', () => {
    const smallest = UI_ZOOM_LEVELS[0]
    const largest = UI_ZOOM_LEVELS[UI_ZOOM_LEVELS.length - 1]

    expect(stepUiZoom(smallest, 'out')).toBe(smallest)
    expect(stepUiZoom(largest, 'in')).toBe(largest)
    expect(canStepUiZoom(smallest, 'out')).toBe(false)
    expect(canStepUiZoom(smallest, 'in')).toBe(true)
  })

  it('snaps an off-ladder value to the nearest stop', () => {
    expect(clampUiZoom(1.02)).toBe(1)
    expect(clampUiZoom(1.4)).toBe(1.5)
    expect(clampUiZoom(0.5)).toBe(UI_ZOOM_LEVELS[0])
    expect(clampUiZoom(9)).toBe(UI_ZOOM_LEVELS[UI_ZOOM_LEVELS.length - 1])
  })

  it('falls back to the default for values that are not numbers', () => {
    expect(clampUiZoom(Number.NaN)).toBe(DEFAULT_UI_ZOOM)
    expect(clampUiZoom(Number.POSITIVE_INFINITY)).toBe(DEFAULT_UI_ZOOM)
  })

  it('formats the percentage the menu shows', () => {
    expect(formatUiZoom(1)).toBe('100%')
    expect(formatUiZoom(1.25)).toBe('125%')
    expect(formatUiZoom(0.8)).toBe('80%')
  })

  it('reports whether the zoom is still at the default', () => {
    expect(isDefaultUiZoom(1)).toBe(true)
    expect(isDefaultUiZoom(1.1)).toBe(false)
  })

  it('round-trips through storage', () => {
    const storage = createStorage()
    saveUiZoom(1.5, storage)

    expect(storage.getItem(UI_ZOOM_STORAGE_KEY)).toBe('1.5')
    expect(loadUiZoom(storage)).toBe(1.5)
  })

  it('reads the default when nothing was stored or the value is unusable', () => {
    expect(loadUiZoom(createStorage())).toBe(DEFAULT_UI_ZOOM)
    expect(loadUiZoom(createStorage({ [UI_ZOOM_STORAGE_KEY]: 'huge' }))).toBe(DEFAULT_UI_ZOOM)
    expect(loadUiZoom(null)).toBe(DEFAULT_UI_ZOOM)
  })
})
