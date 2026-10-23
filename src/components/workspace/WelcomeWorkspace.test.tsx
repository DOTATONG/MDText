import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '../../i18n'
import { WelcomeWorkspace } from './WelcomeWorkspace'

const baseProps = {
  recentFiles: [],
  canOpenFiles: true,
  statusMessage: null,
  onNew: vi.fn(),
  onOpen: vi.fn(),
  onOpenRecent: vi.fn(),
  onRemoveRecent: vi.fn(),
  onClearRecent: vi.fn(),
  t: translations.en,
}

describe('WelcomeWorkspace', () => {
  it('opens Word import from the primary actions when supported', async () => {
    const user = userEvent.setup()
    const onImportDocx = vi.fn()
    render(<WelcomeWorkspace {...baseProps} onImportDocx={onImportDocx} />)

    await user.click(screen.getByRole('button', { name: 'Import Word (.docx)' }))

    expect(onImportDocx).toHaveBeenCalledOnce()
  })

  it('hides Word import when the platform does not support it', () => {
    render(<WelcomeWorkspace {...baseProps} />)

    expect(screen.queryByRole('button', { name: 'Import Word (.docx)' })).not.toBeInTheDocument()
  })

  it('removes a single recent file without opening it', async () => {
    const user = userEvent.setup()
    const onRemoveRecent = vi.fn()
    const onOpenRecent = vi.fn()
    render(
      <WelcomeWorkspace
        {...baseProps}
        recentFiles={[
          { path: '/tmp/a.md', title: 'a.md', lastOpenedAt: '2026-01-01T00:00:00.000Z' },
        ]}
        onOpenRecent={onOpenRecent}
        onRemoveRecent={onRemoveRecent}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove a.md from recent files' }))

    expect(onRemoveRecent).toHaveBeenCalledWith('/tmp/a.md')
    expect(onOpenRecent).not.toHaveBeenCalled()
  })
})
