import { invoke } from '@tauri-apps/api/core'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const imageExtensions: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/bmp': 'bmp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
}

export async function savePreviewImage({ src, fileName, rasterizeSvg, backgroundColor }: {
  src: string
  fileName: string
  rasterizeSvg: boolean
  backgroundColor?: string
}): Promise<string | null> {
  const native = '__TAURI_INTERNALS__' in window
  let imageSource = src
  if (native && /^https?:\/\//i.test(src)) {
    const image = await invoke<{ dataUrl: string }>('read_remote_image_file', { url: src })
    imageSource = image.dataUrl
  }
  const response = await fetch(imageSource)
  if (!response.ok) throw new Error('Unable to read the preview image.')
  let blob = await response.blob()
  if (blob.size === 0 || blob.size > MAX_IMAGE_BYTES) throw new Error('The image is empty or too large to save.')
  if (rasterizeSvg) blob = await svgToPng(blob, backgroundColor)
  const mimeType = blob.type.split(';')[0].toLowerCase()
  const extension = imageExtensions[mimeType]
  if (!extension || blob.size > MAX_IMAGE_BYTES) throw new Error('Unsupported image format or size.')
  const stem = Array.from(fileName.replace(/\.[a-z\d]+$/i, '').replace(/[<>:"/\\|?*]/g, '-'))
    .filter((character) => character.charCodeAt(0) >= 32).join('').replace(/[. ]+$/g, '').slice(0, 100) || 'image'
  const filename = `${stem}.${extension}`
  if (native) {
    return invoke<string | null>('export_preview_image_dialog', {
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
