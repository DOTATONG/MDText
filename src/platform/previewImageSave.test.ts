import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { Blob as NodeBlob } from 'node:buffer'
import { savePreviewImage } from './previewImageSave'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const request = { src: 'data:image/jpeg;base64,/9g=', fileName: 'Photo.png', rasterizeSvg: false }

describe('savePreviewImage', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    vi.mocked(invoke).mockReset().mockResolvedValue('Photo.jpg')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([255, 216]), { headers: { 'Content-Type': 'image/jpeg' } })))
  })

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('preserves original raster bytes and derives the extension from their MIME type', async () => {
    await expect(savePreviewImage(request)).resolves.toBe('Photo.jpg')
    expect(invoke).toHaveBeenCalledWith('export_preview_image_dialog', { bytes: [255, 216], defaultPath: 'Photo.jpg', extension: 'jpg' })
  })

  it('reads remote images through the native reader before saving', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ dataUrl: request.src }).mockResolvedValueOnce('photo.jpg')
    await savePreviewImage({ ...request, src: 'https://example.com/photo.jpg' })
    expect(invoke).toHaveBeenNthCalledWith(1, 'read_remote_image_file', { url: 'https://example.com/photo.jpg' })
    expect(fetch).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenNthCalledWith(2, 'export_preview_image_dialog', expect.objectContaining({ bytes: [255, 216] }))
  })

  it('returns cancellation without reporting a successful save', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null)
    await expect(savePreviewImage(request)).resolves.toBeNull()
  })

  it('rejects non-image content and failed downloads', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }))
    await expect(savePreviewImage({ ...request, src: 'blob:unavailable-image' })).rejects.toThrow('Unsupported image format')
    vi.mocked(fetch).mockResolvedValueOnce(new Response('missing', { status: 404 }))
    await expect(savePreviewImage({ ...request, src: 'blob:unavailable-image' })).rejects.toThrow('Unable to read')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('downloads a blob in the browser and releases its URL after the download starts', async () => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:image-download')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Photo.jpg')
      expect(this.href).toBe('blob:image-download')
    })
    await expect(savePreviewImage(request)).resolves.toBe('Photo.jpg')
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:image-download')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('rasterizes the complete SVG at bounded resolution with its reading background', async () => {
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:diagram'); static revokeObjectURL = revokeObjectURL })
    vi.stubGlobal('Image', class {
      naturalWidth = 3000
      naturalHeight = 1000
      onload: (() => void) | null = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    })
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      void new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }).blob().then(callback)
    })
    await savePreviewImage({ ...request,
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>用户</text></svg>')}`,
      fileName: 'mermaid-diagram.png', rasterizeSvg: true, backgroundColor: '#222222' })
    expect(context.fillStyle).toBe('#222222')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 4096, 1365)
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4096, 1365)
    expect(invoke).toHaveBeenCalledWith('export_preview_image_dialog', { bytes: [137, 80, 78, 71], defaultPath: 'mermaid-diagram.png', extension: 'png' })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagram')
  })
})
