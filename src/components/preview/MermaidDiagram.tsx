import { useEffect, useId, useState } from 'react'
import { renderMermaidDiagram, sanitizeMermaidSvg } from '../../domain/mermaidRenderer'
import type { EffectiveReadingTheme } from '../../domain/readingPreferences'
import type { MarkdownPreviewLabels } from './previewTypes'

export function MermaidDiagram({ chart, labels, sourceLine, theme, onPreview }: {
  chart: string
  labels: MarkdownPreviewLabels
  sourceLine?: number
  theme: EffectiveReadingTheme
  onPreview: (element: HTMLElement) => void
}) {
  const diagramId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  return <div className="mermaid-diagram" data-mdview-mermaid-chart={chart} data-mdview-source-start={sourceLine}
      role="img" aria-label={labels.mermaidDiagram} title={labels.openMermaidPreview} tabIndex={0}
      onDoubleClick={(event) => { event.preventDefault(); onPreview(event.currentTarget) }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPreview(event.currentTarget) } }}
      dangerouslySetInnerHTML={{ __html: svg }} />
}
