import { invoke } from '@tauri-apps/api/core'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const imageExtensions: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/bmp': 'bmp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
}

export class PreviewImageSaveError extends Error {
  readonly stage: 'read' | 'render' | 'save'

  constructor(stage: 'read' | 'render' | 'save', cause: unknown) {
    super(cause instanceof Error ? cause.message : `Unable to ${stage} the preview image.`, { cause })
    this.name = 'PreviewImageSaveError'
    this.stage = stage
  }
}

async function readImageBlob(src: string): Promise<Blob> {
  // data: images are permitted by img-src, but fetching them is blocked by
  // the desktop's connect-src policy. Decode locally instead of making a request.
  if (/^data:/i.test(src)) {
    const comma = src.indexOf(',')
    if (comma < 0) throw new Error('Invalid image data URL.')
    const metadata = src.slice(5, comma).split(';')
    const mimeType = metadata[0].toLowerCase()
    if (!imageExtensions[mimeType]) throw new Error('Unsupported image format.')
    const payload = src.slice(comma + 1)
    if (payload.length > MAX_IMAGE_BYTES * 3) throw new Error('Image data is too large.')
    let bytes: Uint8Array<ArrayBuffer>
    if (metadata.some((part) => part.toLowerCase() === 'base64')) {
      const binary = atob(decodeURIComponent(payload))
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    } else {
      // Percent escapes represent raw bytes, including UTF-8 Chinese labels.
      const buffer = new Uint8Array(Math.min(payload.length * 3, MAX_IMAGE_BYTES))
      let offset = 0
      for (const match of payload.matchAll(/%[\da-f]{2}|[^%]+|%/gi)) {
        const part = match[0]
        if (part.startsWith('%')) {
          if (part.length !== 3) throw new Error('Invalid image data encoding.')
          if (offset >= buffer.length) throw new Error('Image data is too large.')
          buffer[offset++] = parseInt(part.slice(1), 16)
        } else {
          const chunk = new TextEncoder().encode(part)
          if (offset + chunk.length > buffer.length) throw new Error('Image data is too large.')
          buffer.set(chunk, offset)
          offset += chunk.length
        }
      }
      bytes = buffer.slice(0, offset)
    }
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('The image is empty or too large to save.')
    return new Blob([bytes], { type: mimeType })
  }
  const response = await fetch(src)
  if (!response.ok) throw new Error('Unable to read the preview image.')
  return response.blob()
}

export async function savePreviewImage({ src, fileName, rasterizeSvg, backgroundColor }: {
  src: string
  fileName: string
  rasterizeSvg: boolean
  backgroundColor?: string
}): Promise<string | null> {
  let stage: PreviewImageSaveError['stage'] = 'read'
  try {
    const native = '__TAURI_INTERNALS__' in window
    let imageSource = src
    if (native && /^https?:\/\//i.test(src)) {
      const image = await invoke<{ dataUrl: string }>('read_remote_image_file', { url: src })
      imageSource = image.dataUrl
    }
    let blob = await readImageBlob(imageSource)
    if (blob.size === 0 || blob.size > MAX_IMAGE_BYTES) throw new Error('The image is empty or too large to save.')
    if (rasterizeSvg) {
      stage = 'render'
      blob = await svgToPng(blob, backgroundColor)
    }
    const mimeType = blob.type.split(';')[0].toLowerCase()
    const extension = imageExtensions[mimeType]
    if (!extension || blob.size > MAX_IMAGE_BYTES) throw new Error('Unsupported image format or size.')
    const stem = Array.from(fileName.replace(/\.[a-z\d]+$/i, '').replace(/[<>:"/\\|?*]/g, '-'))
      .filter((character) => character.charCodeAt(0) >= 32).join('').replace(/[. ]+$/g, '').slice(0, 100) || 'image'
    const filename = `${stem}.${extension}`
    stage = 'save'
    if (native) {
      return await invoke<string | null>('export_preview_image_dialog', {
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), defaultPath: filename, extension,
      })
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    try { link.click() } finally {
      link.remove()
      // Keep the URL alive until the browser has started reading the download.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    return filename
  } catch (cause) {
    throw new PreviewImageSaveError(stage, cause)
  }
}

async function svgToPng(blob: Blob, backgroundColor = '#ffffff'): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to render the diagram.'))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid diagram dimensions.')
    const scale = Math.min(2, 4096 / image.naturalWidth, 4096 / image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image rendering is unavailable.')
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Unable to create the image.')), 'image/png',
    ))
  } finally { URL.revokeObjectURL(url) }
}
