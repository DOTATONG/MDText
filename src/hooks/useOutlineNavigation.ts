import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'
import { extractMarkdownOutline } from '../domain/markdownOutline'
import {
  MAX_OUTLINE_WIDTH,
  MIN_OUTLINE_WIDTH,
  clampOutlineWidth,
  loadOutlinePreferences,
  saveOutlinePreferences,
  type OutlineDepth,
} from '../domain/outlinePreferences'
import { findActiveIndex, isScrollAtEnd } from '../domain/outlineScroll'

const OUTLINE_KEYBOARD_STEP = 16
/** Keep in sync with `.markdown-preview h1…h6 { scroll-margin-top }`. */
const PREVIEW_HEADING_SCROLL_MARGIN = 24
/**
 * The reading line sits at the scroll margin plus a one-pixel tolerance so a
 * heading scrolled exactly to the margin is not beaten by sub-pixel rounding.
 */
const PREVIEW_HEADING_ACTIVE_OFFSET = PREVIEW_HEADING_SCROLL_MARGIN + 1
/** Safety net for engines that do not dispatch `scrollend`. */
const OUTLINE_JUMP_FALLBACK_MS = 1000
const PENDING_JUMP_MAX_FRAMES = 60
const EMPTY_OUTLINE_ITEMS: ReturnType<typeof extractMarkdownOutline> = []

type OutlineResizeStart = {
  pointerX: number
  width: number
} | null

type OutlineJump = {
  id: string
  timeoutId: number
  /** The smooth scroll has come to rest; the selection is still pinned. */
  settled: boolean
}

type UseOutlineNavigationOptions = {
  documentSessionId?: string
  content: string
  isPreview: boolean
  readingFontKey: string
  previewZoom: number
  /** Whole-interface zoom, applied to the shell with a CSS transform. */
  viewportScale: number
  previewPanelRef: RefObject<HTMLElement | null>
  previewRef: RefObject<HTMLElement | null>
}

export function useOutlineNavigation({
  documentSessionId,
  content,
  isPreview,
  readingFontKey,
  previewZoom,
  viewportScale,
  previewPanelRef,
  previewRef,
}: UseOutlineNavigationOptions) {
  const scale = viewportScale > 0 ? viewportScale : 1
  const initialPreferences = useMemo(() => loadOutlinePreferences(), [])
  const [isOutlineOpen, setIsOutlineOpen] = useState(initialPreferences.isOpen)
  const [outlineWidth, setOutlineWidth] = useState(initialPreferences.width)
  const [outlineDepth, setOutlineDepth] = useState<OutlineDepth>(initialPreferences.maxDepth)
  const [outlineResizeStart, setOutlineResizeStart] = useState<OutlineResizeStart>(null)
  const [pendingHeadingId, setPendingHeadingId] = useState<string | null>(null)
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null)
  const jumpRef = useRef<OutlineJump | null>(null)
  const allItems = useMemo(
    () => isPreview
      ? extractMarkdownOutline(content)
      : EMPTY_OUTLINE_ITEMS,
    [content, isPreview],
  )
  const headingIds = useMemo(() => allItems.map((item) => item.id), [allItems])
  const outlineItems = useMemo(
    () => allItems.filter((item) => item.level <= outlineDepth),
    [allItems, outlineDepth],
  )
  const outlineIds = useMemo(() => outlineItems.map((item) => item.id), [outlineItems])
  const [branches, setBranches] = useState({
    session: documentSessionId,
    items: allItems,
    active: activeOutlineId,
    collapsed: new Set<string>(),
  })
  if (branches.session !== documentSessionId || branches.items !== allItems || branches.active !== activeOutlineId) {
    const validIds = new Set(allItems.map((item) => item.id))
    const collapsed = branches.session !== documentSessionId
      ? new Set<string>()
      : new Set([...branches.collapsed].filter((id) => !isPreview || validIds.has(id)))
    if (branches.active !== activeOutlineId && activeOutlineId) {
      const parents: typeof outlineItems = []
      for (const item of outlineItems) {
        while (parents.length && parents[parents.length - 1].level >= item.level) parents.pop()
        if (item.id === activeOutlineId) {
          parents.forEach((parent) => collapsed.delete(parent.id))
          break
        }
        parents.push(item)
      }
    }
    setBranches({ session: documentSessionId, items: allItems, active: activeOutlineId, collapsed })
  }
  const toggleOutlineBranch = (id: string) => setBranches((current) => {
    const collapsed = new Set(current.collapsed)
    if (collapsed.has(id)) collapsed.delete(id)
    else collapsed.add(id)
    return { ...current, collapsed }
  })
  const setOutlineSubtree = (id: string, expanded: boolean) => setBranches((current) => {
    const index = allItems.findIndex((item) => item.id === id)
    if (index < 0) return current
    const collapsed = new Set(current.collapsed)
    for (let cursor = index; cursor < allItems.length; cursor++) {
      const item = allItems[cursor]
      if (cursor > index && item.level <= allItems[index].level) break
      if (expanded) collapsed.delete(item.id)
      else if (allItems[cursor + 1]?.level > item.level) collapsed.add(item.id)
    }
    return { ...current, collapsed }
  })
  const setAllOutlineBranches = (expanded: boolean) => setBranches((current) => ({
    ...current,
    collapsed: expanded ? new Set<string>() : new Set(allItems
      .filter((item, index) => allItems[index + 1]?.level > item.level)
      .map((item) => item.id)),
  }))

  /**
   * Computes the active heading from the live layout every time. Reading the
   * current geometry instead of cached offsets keeps the outline in sync when
   * images, diagrams or fonts change the height of the document while reading.
   *
   * `preferredId` is the heading the reader just jumped to: when it was
   * scrolled as far as the end of the document allows, it stays selected
   * instead of snapping back to the previous heading.
   */
  const updateActiveOutlineFromPreview = useCallback((preferredId?: string) => {
    if (jumpRef.current) {
      return
    }

    const previewPanel = previewPanelRef.current
    if (!isPreview || !previewPanel) {
      setActiveOutlineId(null)
      return
    }

    const headings = collectOutlineHeadings(previewPanel, outlineIds)
    const panelRect = previewPanel.getBoundingClientRect()
    const atEnd = isScrollAtEnd(previewPanel)
    const activeIndex = findActiveIndex(
      headings.length,
      (index) => (headings[index].getBoundingClientRect().top - panelRect.top) / scale,
      PREVIEW_HEADING_ACTIVE_OFFSET,
      atEnd,
    )
    let nextActiveId = activeIndex === null ? null : headings[activeIndex].id

    if (atEnd && preferredId) {
      const preferred = headings.find((heading) => heading.id === preferredId)
      if (preferred) {
        const preferredRect = preferred.getBoundingClientRect()
        const top = (preferredRect.top - panelRect.top) / scale
        if (top > PREVIEW_HEADING_ACTIVE_OFFSET && preferredRect.top <= panelRect.bottom) {
          nextActiveId = preferredId
        }
      }
    }

    setActiveOutlineId((currentId) => currentId === nextActiveId ? currentId : nextActiveId)
  }, [isPreview, outlineIds, previewPanelRef, scale])

  /**
   * Marks the programmatic scroll as finished without recomputing the active
   * item. The clicked entry stays selected even if rounding or the end of the
   * document prevents its heading from reaching the reading line exactly.
   */
  const settleOutlineJump = useCallback(() => {
    const jump = jumpRef.current
    if (!jump || jump.settled) {
      return
    }

    window.clearTimeout(jump.timeoutId)
    jump.settled = true
  }, [])

  /** Releases the pinned selection and resumes position-based tracking. */
  const releaseOutlineJump = useCallback((keepJumpTarget = false) => {
    const jump = jumpRef.current
    if (!jump) {
      return
    }

    window.clearTimeout(jump.timeoutId)
    jumpRef.current = null
    updateActiveOutlineFromPreview(keepJumpTarget ? jump.id : undefined)
  }, [updateActiveOutlineFromPreview])

  const beginOutlineJump = useCallback((headingId: string) => {
    const currentJump = jumpRef.current
    if (currentJump) {
      window.clearTimeout(currentJump.timeoutId)
    }

    jumpRef.current = {
      id: headingId,
      timeoutId: window.setTimeout(settleOutlineJump, OUTLINE_JUMP_FALLBACK_MS),
      settled: false,
    }
    setActiveOutlineId(headingId)
  }, [settleOutlineJump])

  useEffect(() => {
    saveOutlinePreferences({
      width: outlineWidth,
      isOpen: isOutlineOpen,
      maxDepth: outlineDepth,
    })
  }, [isOutlineOpen, outlineDepth, outlineWidth])

  useEffect(() => {
    return () => {
      if (jumpRef.current !== null) {
        window.clearTimeout(jumpRef.current.timeoutId)
        jumpRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!pendingHeadingId) {
      return
    }

    const headingId = pendingHeadingId
    let frameId: number | null = null
    let attempts = 0
    let cancelled = false

    function tryPendingJump() {
      frameId = null
      if (cancelled) {
        return
      }

      const previewPanel = previewPanelRef.current
      if (!previewPanel || !findPreviewHeading(previewPanel, headingId)) {
        // The target document and its preview may not have rendered yet.
        attempts += 1
        if (attempts < PENDING_JUMP_MAX_FRAMES) {
          frameId = window.requestAnimationFrame(tryPendingJump)
        } else {
          setPendingHeadingId(null)
        }
        return
      }

      beginOutlineJump(headingId)
      scrollPreviewHeadingIntoView(previewPanel, headingId, scale)
      setPendingHeadingId(null)
    }

    frameId = window.requestAnimationFrame(tryPendingJump)

    return () => {
      cancelled = true
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [allItems, beginOutlineJump, pendingHeadingId, previewPanelRef, scale])

  useEffect(() => {
    if (!outlineResizeStart) {
      return
    }

    const resizeStart = outlineResizeStart

    function handlePointerMove(event: PointerEvent) {
      setOutlineWidth(
        clampOutlineWidth(resizeStart.width + event.clientX - resizeStart.pointerX),
      )
    }

    function handlePointerUp() {
      setOutlineResizeStart(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [outlineResizeStart])

  // Recompute the selection after layout changes that happen without a scroll
  // (lazy images, diagrams, asynchronous math, zoom or font changes).
  useEffect(() => {
    const previewPanel = previewPanelRef.current
    if (!isPreview || !previewPanel || outlineIds.length === 0) {
      return
    }

    let frameId: number | null = null
    let observedPreview: HTMLElement | null = null
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleActiveOutlineUpdate)
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
        observePreview()
        scheduleActiveOutlineUpdate()
      })

    function scheduleActiveOutlineUpdate() {
      if (frameId !== null) {
        return
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        if (!jumpRef.current) {
          updateActiveOutlineFromPreview()
        }
      })
    }

    function observePreview() {
      const preview = previewRef.current
      if (!resizeObserver || !preview || observedPreview === preview) {
        return
      }
      if (observedPreview) {
        resizeObserver.unobserve(observedPreview)
      }
      resizeObserver.observe(preview)
      observedPreview = preview
    }

    observePreview()
    resizeObserver?.observe(previewPanel)
    mutationObserver?.observe(previewPanel, { childList: true, subtree: true })
    window.addEventListener('resize', scheduleActiveOutlineUpdate)
    scheduleActiveOutlineUpdate()

    return () => {
      window.removeEventListener('resize', scheduleActiveOutlineUpdate)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [
    isPreview,
    outlineIds,
    previewPanelRef,
    previewRef,
    readingFontKey,
    previewZoom,
    updateActiveOutlineFromPreview,
  ])

  useEffect(() => {
    const previewPanel = previewPanelRef.current
    if (!isPreview || !previewPanel || outlineIds.length === 0) {
      if (jumpRef.current) {
        window.clearTimeout(jumpRef.current.timeoutId)
        jumpRef.current = null
      }
      setActiveOutlineId(null)
      return
    }

    const activePreviewPanel = previewPanel
    let frameId: number | null = null

    function updateActiveOutlineId() {
      frameId = null
      updateActiveOutlineFromPreview()
    }

    function scheduleActiveOutlineUpdate() {
      const jump = jumpRef.current
      if (jump) {
        // Scroll events emitted by the jump itself keep the pinned selection.
        // Once it has settled, the next scroll means the reader took over.
        if (jump.settled) {
          releaseOutlineJump()
        }
        return
      }

      if (frameId === null) {
        frameId = window.requestAnimationFrame(updateActiveOutlineId)
      }
    }

    // The browser reports the end of a programmatic smooth scroll precisely;
    // the fallback timer in beginOutlineJump covers engines without it.
    function handleScrollEnd() {
      settleOutlineJump()
    }

    // Direct user input releases the pinned selection immediately so the
    // outline follows the reader again.
    function handleManualScrollStart() {
      if (jumpRef.current) {
        releaseOutlineJump()
      }
    }

    scheduleActiveOutlineUpdate()
    activePreviewPanel.addEventListener('scroll', scheduleActiveOutlineUpdate, { passive: true })
    activePreviewPanel.addEventListener('scrollend', handleScrollEnd)
    activePreviewPanel.addEventListener('wheel', handleManualScrollStart, { passive: true })
    activePreviewPanel.addEventListener('touchstart', handleManualScrollStart, { passive: true })
    activePreviewPanel.addEventListener('keydown', handleManualScrollStart)

    return () => {
      activePreviewPanel.removeEventListener('scroll', scheduleActiveOutlineUpdate)
      activePreviewPanel.removeEventListener('scrollend', handleScrollEnd)
      activePreviewPanel.removeEventListener('wheel', handleManualScrollStart)
      activePreviewPanel.removeEventListener('touchstart', handleManualScrollStart)
      activePreviewPanel.removeEventListener('keydown', handleManualScrollStart)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [
    isPreview,
    outlineIds,
    previewPanelRef,
    releaseOutlineJump,
    settleOutlineJump,
    updateActiveOutlineFromPreview,
  ])

  useEffect(() => {
    if (jumpRef.current) {
      window.clearTimeout(jumpRef.current.timeoutId)
      jumpRef.current = null
    }
  }, [outlineIds])

  const handleOutlineJump = useCallback((id: string) => {
    beginOutlineJump(id)

    const previewPanel = previewPanelRef.current
    if (previewPanel) {
      scrollPreviewHeadingIntoView(previewPanel, id, scale)
    }
  }, [beginOutlineJump, previewPanelRef, scale])

  const handleOutlineResizeKey = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    setOutlineWidth((currentWidth) =>
      clampOutlineWidth(
        currentWidth + (event.key === 'ArrowRight' ? OUTLINE_KEYBOARD_STEP : -OUTLINE_KEYBOARD_STEP),
      ),
    )
  }, [])

  const beginOutlineResize = useCallback((pointerX: number) => {
    setOutlineResizeStart({ pointerX, width: outlineWidth })
  }, [outlineWidth])
  const closeOutline = useCallback(() => setIsOutlineOpen(false), [])
  const openOutline = useCallback(() => setIsOutlineOpen(true), [])
  const restoreOutlineLayout = useCallback((layout: { width: number; isOpen: boolean }) => {
    setOutlineWidth(clampOutlineWidth(layout.width))
    setIsOutlineOpen(layout.isOpen)
  }, [])
  const queueHeadingJump = useCallback((headingId?: string) => {
    setPendingHeadingId(headingId ?? null)
  }, [])

  return {
    collapsedOutlineIds: branches.collapsed,
    headingIds,
    setOutlineSubtree,
    toggleOutlineBranch,
    setAllOutlineBranches,
    activeOutlineId,
    beginOutlineResize,
    closeOutline,
    handleOutlineJump,
    handleOutlineResizeKey,
    isOutlineOpen,
    openOutline,
    outlineItems,
    outlineDepth,
    outlineWidth,
    queueHeadingJump,
    restoreOutlineLayout,
    setOutlineDepth,
  }
}

/**
 * Looks the heading up inside the preview panel. A document-wide
 * `getElementById` would also match fixed application IDs such as
 * `about-title` and could scroll the wrong element.
 */
function findPreviewHeading(previewPanel: HTMLElement, headingId: string): HTMLElement | null {
  const quotedId = headingId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return previewPanel.querySelector<HTMLElement>(`[id="${quotedId}"]`)
}

/** Headings listed in the outline, in document order. */
function collectOutlineHeadings(
  previewPanel: HTMLElement,
  outlineIds: readonly string[],
): HTMLElement[] {
  if (outlineIds.length === 0) {
    return []
  }

  const outlineIdSet = new Set(outlineIds)
  return Array.from(previewPanel.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5'))
    .filter((heading) => outlineIdSet.has(heading.id))
}

function scrollPreviewHeadingIntoView(
  previewPanel: HTMLElement,
  headingId: string,
  viewportScale: number,
): boolean {
  const heading = findPreviewHeading(previewPanel, headingId)
  if (!heading) {
    return false
  }

  // `getBoundingClientRect()` is in scaled visual pixels while `scrollTop` is
  // in layout pixels; convert before mixing the two (interface zoom).
  const scale = viewportScale > 0 ? viewportScale : 1
  const headingTop = (
    heading.getBoundingClientRect().top - previewPanel.getBoundingClientRect().top
  ) / scale
  const targetTop = Math.max(
    0,
    previewPanel.scrollTop + headingTop - PREVIEW_HEADING_SCROLL_MARGIN,
  )
  if (typeof previewPanel.scrollTo === 'function') {
    previewPanel.scrollTo({ top: targetTop, behavior: scrollBehavior() })
  } else {
    previewPanel.scrollTop = targetTop
  }
  return true
}

function scrollBehavior(): ScrollBehavior {
  if (typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'auto'
  }
  return 'smooth'
}

export { MAX_OUTLINE_WIDTH, MIN_OUTLINE_WIDTH }
