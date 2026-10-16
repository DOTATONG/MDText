import { describe, expect, it } from 'vitest'
import { isImagePath, partitionDroppedPaths } from './droppedFiles'

describe('partitionDroppedPaths', () => {
  it('opens a dropped Markdown document', () => {
    expect(partitionDroppedPaths(['C:\\docs\\readme.md'])).toEqual({
      markdownPath: 'C:\\docs\\readme.md',
      imagePaths: [],
    })
  })

  it('collects dropped images', () => {
    expect(partitionDroppedPaths(['/home/user/photo.PNG', '/home/user/diagram.webp'])).toEqual({
      markdownPath: null,
      imagePaths: ['/home/user/photo.PNG', '/home/user/diagram.webp'],
    })
  })

  it('prefers the document when files are dropped together', () => {
    expect(partitionDroppedPaths(['/tmp/photo.png', '/tmp/notes.markdown'])).toEqual({
      markdownPath: '/tmp/notes.markdown',
      imagePaths: ['/tmp/photo.png'],
    })
  })

  it('ignores unsupported files', () => {
    expect(partitionDroppedPaths(['/tmp/notes.txt', '/tmp/archive.zip', '/tmp/vector.svg'])).toEqual({
      markdownPath: null,
      imagePaths: [],
    })
  })

  it('ignores a file without an extension', () => {
    expect(isImagePath('/tmp/README')).toBe(false)
    expect(partitionDroppedPaths(['/tmp/README']).markdownPath).toBeNull()
  })

  it('matches image extensions case-insensitively', () => {
    expect(isImagePath('/tmp/PHOTO.JPEG')).toBe(true)
  })
})
