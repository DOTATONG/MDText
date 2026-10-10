import { useEffect, useId, useState } from 'react'
import { renderMermaidDiagram, sanitizeMermaidSvg } from '../../domain/mermaidRenderer'
import type { EffectiveReadingTheme } from '../../domain/readingPreferences'
import type { MarkdownPreviewLabels } from './previewTypes'
import { MediaPreviewDialog } from './MediaPreviewDialog'

export function MermaidDiagram({ chart, labels, sourceLine, theme }: {
  chart: string
  labels: MarkdownPreviewLabels
  sourceLine?: number
  theme: EffectiveReadingTheme
}) {
  const diagramId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    void renderMermaidDiagram(`mdview-mermaid-${diagramId}`, chart, theme)
      .then((result) => {
        if (!canceled) { setError(null); setSvg(sanitizeMermaidSvg(result.svg)) }
      })
      .catch((renderError: unknown) => {
        if (!canceled) {
          setSvg(null)
          setError(renderError instanceof Error ? renderError.message : labels.mermaidError)
        }
      })
    return () => { canceled = true }
  }, [chart, diagramId, labels.mermaidError, theme])

  if (error) return <div className="mermaid-error" role="alert"><strong>{labels.mermaidError}</strong><span>{error}</span><pre><code>{chart}</code></pre></div>
  if (!svg) return <div className="mermaid-loading" data-mdview-mermaid-chart={chart} data-mdview-source-start={sourceLine}>{labels.mermaidLoading}</div>
  function openPreview() {
    // An image document isolates SVG IDs from the inline diagram's markers/styles.
    const document = new DOMParser().parseFromString(svg!, 'image/svg+xml')
    const root = document.documentElement
    const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
    if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
      root.setAttribute('width', String(viewBox[2]))
      root.setAttribute('height', String(viewBox[3]))
    }
    setPreviewSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`)
  }

  return <>
    <div className="mermaid-diagram" data-mdview-mermaid-chart={chart} data-mdview-source-start={sourceLine}
      role="img" aria-label={labels.mermaidDiagram} title={labels.openMermaidPreview} tabIndex={0}
      onDoubleClick={(event) => { event.preventDefault(); openPreview() }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPreview() } }}
      dangerouslySetInnerHTML={{ __html: svg }} />
    {previewSrc ? <MediaPreviewDialog src={previewSrc} alt={labels.mermaidDiagram} title={labels.mermaidDiagram}
      closeLabel={labels.closeMermaidPreview} labels={labels} onClose={() => setPreviewSrc(null)} /> : null}
  </>
}
