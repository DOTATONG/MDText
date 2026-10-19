import { toString } from 'mdast-util-to-string'
import type { Heading, Root, RootContent } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified, type Plugin } from 'unified'

export type MarkdownOutlineItem = {
  id: string
  level: 1 | 2 | 3 | 4 | 5
  text: string
}

export type RemarkHeadingIdsOptions = {
  /** IDs computed by `extractMarkdownOutline` for the same document. */
  headingIds?: readonly string[]
}

type HeadingIdCounts = Map<string, number>

const markdownParser = unified().use(remarkParse).use(remarkGfm)

/**
 * Parses the document once and returns its headings together with the IDs that
 * the preview renderer should use. Both the outline and the preview must share
 * this result so a jump always targets an element that actually exists.
 */
export function extractMarkdownOutline(content: string): MarkdownOutlineItem[] {
  return assignHeadingIds(markdownParser.parse(content))
}

/**
 * Remark plugin that stamps the outline IDs onto the very same heading nodes
 * the preview renders. Pass `headingIds` to reuse the outline's IDs verbatim;
 * without it the IDs are derived from this tree with identical rules.
 */
export const remarkHeadingIds: Plugin<[RemarkHeadingIdsOptions?], Root> = (options) => (tree) => {
  assignHeadingIds(tree, options?.headingIds)
}

function assignHeadingIds(
  tree: Root,
  headingIds?: readonly string[],
): MarkdownOutlineItem[] {
  const idCounts = createHeadingIdCounts()
  const usedIds = new Set(headingIds ?? [])
  const items: MarkdownOutlineItem[] = []
  let headingIndex = 0

  for (const node of tree.children) {
    if (!isOutlineHeading(node)) continue

    const text = getHeadingText(node)
    const id = headingIds?.[headingIndex] ?? createAvailableHeadingId(text, idCounts, usedIds)
    usedIds.add(id)
    setHeadingId(node, id)
    items.push({ id, level: node.depth as MarkdownOutlineItem['level'], text })
    headingIndex += 1
  }

  return items
}

function isOutlineHeading(node: RootContent): node is Heading {
  return node.type === 'heading' && node.depth <= 5
}

/**
 * Uses the visible text of a heading: raw HTML tags are omitted while the text
 * they wrap, image alt text and the like are kept. This mirrors what a reader
 * sees and keeps generated IDs close to the rendered anchor.
 */
function getHeadingText(heading: Heading): string {
  return toString(heading, { includeHtml: false }).trim()
}

function setHeadingId(node: Heading, id: string) {
  const data = (node.data ??= {})
  const properties = typeof data.hProperties === 'object' && data.hProperties !== null
    ? data.hProperties
    : {}
  // The sanitize schema strips arbitrary `id` attributes, so the ID travels
  // through a dedicated data attribute and becomes the element ID afterwards.
  data.hProperties = { ...properties, dataMdviewHeadingId: id }
}

export function createHeadingIdCounts(): HeadingIdCounts {
  return new Map<string, number>()
}

export function createUniqueHeadingId(text: string, counts: HeadingIdCounts): string {
  const baseId = slugifyHeading(text) || 'heading'
  const nextCount = (counts.get(baseId) ?? 0) + 1
  counts.set(baseId, nextCount)

  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`
}

function createAvailableHeadingId(
  text: string,
  counts: HeadingIdCounts,
  usedIds: ReadonlySet<string>,
): string {
  let id = createUniqueHeadingId(text, counts)
  while (usedIds.has(id)) {
    id = createUniqueHeadingId(text, counts)
  }
  return id
}

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
