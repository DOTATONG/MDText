import { useCallback, useEffect, useState } from 'react'
import {
  canStepUiZoom,
  clampUiZoom,
  DEFAULT_UI_ZOOM,
  formatUiZoom,
  isDefaultUiZoom,
  loadUiZoom,
  saveUiZoom,
  stepUiZoom,
} from '../domain/uiZoom'
import { applyUiZoom } from '../platform/uiZoom'

type UseUiZoomOptions = {
  /** Receives the new percentage after every change, so the level is visible while zooming. */
  onNotify: (message: string) => void
}

/**
 * Whole-interface zoom: persists the level and applies it to the document root.
 */
export function useUiZoom({ onNotify }: UseUiZoomOptions) {
  const [uiZoom, setUiZoom] = useState(loadUiZoom)

  useEffect(() => {
    applyUiZoom(uiZoom)
    saveUiZoom(uiZoom)
  }, [uiZoom])

  const zoomTo = useCallback((next: number) => {
    const zoom = clampUiZoom(next)
    setUiZoom(zoom)
    onNotify(formatUiZoom(zoom))
  }, [onNotify])

  const zoomIn = useCallback(() => zoomTo(stepUiZoom(uiZoom, 'in')), [uiZoom, zoomTo])
  const zoomOut = useCallback(() => zoomTo(stepUiZoom(uiZoom, 'out')), [uiZoom, zoomTo])
  const resetZoom = useCallback(() => zoomTo(DEFAULT_UI_ZOOM), [zoomTo])

  return {
    canZoomIn: canStepUiZoom(uiZoom, 'in'),
    canZoomOut: canStepUiZoom(uiZoom, 'out'),
    isDefaultZoom: isDefaultUiZoom(uiZoom),
    resetZoom,
    uiZoom,
    zoomIn,
    zoomOut,
  }
}
