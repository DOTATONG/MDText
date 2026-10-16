import { isMarkdownPath } from './markdownFiles'

export type DroppedPaths = {
  /** The first dropped Markdown document. Opening a document outranks importing images. */
  markdownPath: string | null
  /** Every dropped image the editor can copy into the assets folder. */
  imagePaths: string[]
}

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif'])

/**
 * Splits the paths reported by a native window drop.
 *
 * The operating system reports paths rather than `File` objects, so the file type has to come from
 * the extension: there is no MIME type to consult.
 */
export function partitionDroppedPaths(paths: string[]): DroppedPaths {
  return {
    markdownPath: paths.find(isMarkdownPath) ?? null,
    imagePaths: paths.filter(isImagePath),
  }
}

export function isImagePath(path: string): boolean {
  const extension = path.split('.').at(-1)?.toLowerCase()
  return extension !== undefined
    && extension !== path.toLowerCase()
    && imageExtensions.has(extension)
}
