import { sanitizeMermaidSvg } from '../../domain/mermaidRenderer'
import type { MarkdownPreviewLabels } from './previewTypes'

export type PreviewMedia = { src: string; alt: string; title: string; closeLabel: string }

export function readPreviewMedia(element: HTMLElement, labels: MarkdownPreviewLabels): PreviewMedia | null {
  if (element.tagName === 'IMG') {
    const src = element.getAttribute('src')
    if (!src) return null
    return { src, alt: labels.imagePreviewAlt(element.getAttribute('alt') || 'Image'), title: labels.imagePreview, closeLabel: labels.closeImagePreview }
  }
  const svg = element.querySelector('svg')
  if (!svg) return null
  // Isolate SVG IDs from the inline diagram and retain its intrinsic aspect ratio.
  const document = new DOMParser().parseFromString(sanitizeMermaidSvg(svg.outerHTML), 'image/svg+xml')
  const root = document.documentElement
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    root.setAttribute('width', String(viewBox[2]))
    root.setAttribute('height', String(viewBox[3]))
  }
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`,
    alt: labels.mermaidDiagram, title: labels.mermaidDiagram, closeLabel: labels.closeMermaidPreview,
  }
}
