import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DocumentOutline } from './DocumentOutline'
import type { MarkdownOutlineItem } from '../../domain/markdownOutline'
import { translations } from '../../i18n'

describe('DocumentOutline', () => {
  it('jumps on click and toggles branches from the disclosure control', async () => {
    const user = userEvent.setup()
    const onJump = vi.fn()
    const onToggleBranch = vi.fn()
    const { rerender } = render(<DocumentOutline
      items={[
        { id: 'intro', level: 1, text: 'Intro' },
        { id: 'details', level: 2, text: 'Details' },
      ]}
      maxDepth={5}
      onJump={onJump}
      onToggleBranch={onToggleBranch}
      onMaxDepthChange={vi.fn()}
      onClose={vi.fn()}
      t={translations.en}
    />)

    const heading = screen.getByRole('button', { name: 'Jump to Intro' })
    await user.click(heading)
    expect(onJump).toHaveBeenCalledExactlyOnceWith('intro')
    expect(onToggleBranch).not.toHaveBeenCalled()

    const toggle = screen.getByRole('button', { name: 'Collapse section: Intro' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle)
    expect(onToggleBranch).toHaveBeenCalledExactlyOnceWith('intro')
    expect(onJump).toHaveBeenCalledTimes(1)

    rerender(<DocumentOutline
      items={[
        { id: 'intro', level: 1, text: 'Intro' },
        { id: 'details', level: 2, text: 'Details' },
      ]}
      collapsedIds={new Set(['intro'])}
      maxDepth={5}
      onJump={onJump}
      onToggleBranch={onToggleBranch}
      onMaxDepthChange={vi.fn()}
      onClose={vi.fn()}
      t={translations.en}
    />)

    expect(screen.getByRole('button', { name: 'Expand section: Intro' }))
      .toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Jump to Details' })).not.toBeInTheDocument()
  })

  it('jumps immediately when a heading has children but branching is unavailable', () => {
    const onJump = vi.fn()
    render(<DocumentOutline
      items={[
        { id: 'intro', level: 1, text: 'Intro' },
        { id: 'details', level: 2, text: 'Details' },
      ]}
      maxDepth={5}
      onJump={onJump}
      onMaxDepthChange={vi.fn()}
      onClose={vi.fn()}
      t={translations.en}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Jump to Intro' }))
    expect(onJump).toHaveBeenCalledExactlyOnceWith('intro')
    expect(screen.queryByRole('button', { name: 'Collapse section: Intro' })).not.toBeInTheDocument()
  })

  it('marks the active heading for visual and accessibility state', () => {
    render(
      <DocumentOutline
        items={[
          { id: 'intro', level: 1, text: 'Intro' },
          { id: 'details', level: 2, text: 'Details' },
        ]}
        activeId="details"
        maxDepth={3}
        onJump={vi.fn()}
        onMaxDepthChange={vi.fn()}
        onClose={vi.fn()}
        t={translations.en}
      />,
    )

    const inactiveHeading = screen.getByRole('button', { name: 'Jump to Intro' })
    const activeHeading = screen.getByRole('button', { name: 'Jump to Details' })

    expect(inactiveHeading).not.toHaveClass('active')
    expect(inactiveHeading).not.toHaveAttribute('aria-current')
    expect(activeHeading).toHaveClass('active')
    expect(activeHeading).toHaveAttribute('aria-current', 'location')
    expect(screen.queryByText('2 headings')).not.toBeInTheDocument()
  })

  it('keeps the active heading visible when the current reading heading changes', () => {
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView

    try {
      const items: MarkdownOutlineItem[] = [
        { id: 'intro', level: 1, text: 'Intro' },
        { id: 'details', level: 2, text: 'Details' },
      ]
      const props = {
        items,
        maxDepth: 3 as const,
        onJump: vi.fn(),
        onMaxDepthChange: vi.fn(),
        onClose: vi.fn(),
        t: translations.en,
      }
      const { rerender } = render(<DocumentOutline {...props} activeId="intro" />)

      expect(scrollIntoView).toHaveBeenLastCalledWith({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      })

      scrollIntoView.mockClear()
      rerender(<DocumentOutline {...props} activeId="details" />)

      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      })
      expect(screen.getByRole('button', { name: 'Jump to Details' })).toHaveAttribute(
        'aria-current',
        'location',
      )
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('changes the maximum outline depth from the header icon', async () => {
    const user = userEvent.setup()
    const onMaxDepthChange = vi.fn()
    render(
      <DocumentOutline
        items={[]}
        maxDepth={3}
        onJump={vi.fn()}
        onMaxDepthChange={onMaxDepthChange}
        onClose={vi.fn()}
        t={translations.en}
      />,
    )

    await user.click(screen.getByLabelText('Set outline depth'))
    expect(screen.getByRole('button', { name: 'Show through heading level 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Show through heading level 4' }))

    expect(onMaxDepthChange).toHaveBeenCalledWith(4)

    await user.click(screen.getByLabelText('Set outline depth'))
    await user.click(screen.getByRole('button', { name: 'Show through heading level 5' }))

    expect(onMaxDepthChange).toHaveBeenCalledWith(5)
  })
})
