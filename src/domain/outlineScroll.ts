export type OutlineHeadingPosition = {
  id: string
  top: number
}

/**
 * Returns the heading that owns the current reading position.
 *
 * The active heading is the last one whose top edge has crossed the reading
 * line (`scrollTop + activationOffset`). At the end of the document the last
 * heading wins, because it often cannot be scrolled up to the reading line and
 * would otherwise never become active.
 */
export function findActiveOutlineId(
  headings: OutlineHeadingPosition[],
  scrollTop: number,
  activationOffset: number,
  isAtDocumentEnd = false,
): string | null {
  const index = findActiveIndex(
    headings.length,
    (index) => headings[index].top,
    scrollTop + activationOffset,
    isAtDocumentEnd,
  )
  return index === null ? null : headings[index].id
}

/**
 * Index-based variant used by the preview, which reads heading positions from
 * the live layout instead of a cached list. `getTop` is expected to return
 * positions ordered from the top of the document, so only O(log n) values are
 * read while scrolling.
 */
export function findActiveIndex(
  count: number,
  getTop: (index: number) => number,
  activationTop: number,
  isAtDocumentEnd = false,
): number | null {
  if (count === 0) {
    return null
  }

  if (isAtDocumentEnd) {
    return count - 1
  }

  let lower = 0
  let upper = count - 1
  let activeIndex = 0

  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (getTop(middle) <= activationTop) {
      activeIndex = middle
      lower = middle + 1
    } else {
      upper = middle - 1
    }
  }

  return activeIndex
}

/** Whether the scroll container is scrollable and resting at its maximum offset. */
export function isScrollAtEnd(element: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}): boolean {
  if (element.scrollHeight <= element.clientHeight + 1) {
    return false
  }

  return element.scrollTop + element.clientHeight >= element.scrollHeight - 1
}
