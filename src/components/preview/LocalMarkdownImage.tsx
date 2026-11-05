import { useEffect, useState, type ComponentProps } from 'react'
import { resolveLocalMarkdownResource } from '../../domain/localMarkdownResources'
import type { FileAccess } from '../../platform/fileAccess'

type Props = Omit<ComponentProps<'img'>, 'src' | 'alt'> & {
  src?: string
  alt?: string
  sourcePath?: string | null
  readLocalImageFile?: FileAccess['readLocalImageFile']
  onPreview: (element: HTMLElement) => void
}

export function LocalMarkdownImage({ src, alt, className, sourcePath, readLocalImageFile, onPreview, ...props }: Props) {
  const [resolvedSrc, setResolvedSrc] = useState(src)
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

  // Images stay in the inline flow everywhere, including inside links, so they
  // never introduce a block-level line break; there is no figure caption.
  return <img
    src={displaySrc}
    alt={alt}
    className={className ? `markdown-inline-image ${className}` : 'markdown-inline-image'}
    onClick={(event) => displaySrc && onPreview(event.currentTarget)}
    {...props}
  />
}
