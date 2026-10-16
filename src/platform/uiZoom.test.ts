import { afterEach, describe, expect, it } from 'vitest'
import { applyUiZoom } from './uiZoom'

describe('applyUiZoom', () => {
  afterEach(() => {
    document.documentElement.style.cssText = ''
  })

  it('publishes the zoom factor the shell scales by', () => {
    applyUiZoom(1.5)

    expect(document.documentElement.style.getPropertyValue('--ui-zoom')).toBe('1.5')
  })

  it('snaps an off-ladder factor to a stop', () => {
    applyUiZoom(1.42)

    expect(document.documentElement.style.getPropertyValue('--ui-zoom')).toBe('1.5')
  })
})
