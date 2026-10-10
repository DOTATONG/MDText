import { useEffect, useState, type ComponentProps } from 'react'
import { MediaPreviewDialog } from './MediaPreviewDialog'
import { resolveLocalMarkdownResource } from '../../domain/localMarkdownResources'
import type { FileAccess } from '../../platform/fileAccess'
import type { MarkdownPreviewLabels } from './previewTypes'

type Props = Omit<ComponentProps<'img'>, 'src' | 'alt'> & {
  src?: string
  alt?: string
  sourcePath?: string | null
  readLocalImageFile?: FileAccess['readLocalImageFile']
  labels: MarkdownPreviewLabels
}

export function LocalMarkdownImage({ src, alt, sourcePath, readLocalImageFile, labels, ...props }: Props) {
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const resource = resolveLocalMarkdownResource(src, sourcePath)
  const displaySrc = resource?.kind === 'image' && readLocalImageFile ? resolvedSrc : src

  useEffect(() => {
    let canceled = false
    if (resource?.kind !== 'image' || !readLocalImageFile) {
      return
    }
    void readLocalImageFile(resource.path)
      .then((image) => { if (!canceled) setResolvedSrc(image.dataUrl) })
      .catch(() => { if (!canceled) setResolvedSrc(src) })
    return () => { canceled = true }
  }, [readLocalImageFile, resource?.kind, resource?.path, src])

  return <>
    <span className="markdown-image">
      <img src={displaySrc} alt={alt} onClick={() => displaySrc && setPreviewSrc(displaySrc)} {...props} />
      {alt ? <span className="markdown-image-caption">{alt}</span> : null}
    </span>
    {previewSrc ? <MediaPreviewDialog src={previewSrc} alt={labels.imagePreviewAlt(alt ?? 'Image')} title={labels.imagePreview}
      closeLabel={labels.closeImagePreview} labels={labels} onClose={() => setPreviewSrc(null)} /> : null}
  </>
}
