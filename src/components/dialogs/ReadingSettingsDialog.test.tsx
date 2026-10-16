import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_READING_PREFERENCES } from '../../domain/readingPreferences'
import { translations } from '../../i18n'
import { ReadingSettingsDialog } from './ReadingSettingsDialog'

const { listSystemFontFamilies } = vi.hoisted(() => ({
  listSystemFontFamilies: vi.fn(async () => ['Aptos', 'Microsoft YaHei', 'Segoe UI']),
}))

vi.mock('../../platform/systemFonts', () => ({
  systemFontAccess: {
    supportsSystemFonts: true,
    listSystemFontFamilies,
  },
}))

describe('ReadingSettingsDialog', () => {
  it('loads and selects an installed reading font', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(
      <ReadingSettingsDialog
        open
        preferences={DEFAULT_READING_PREFERENCES}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onUpdate={onUpdate}
        t={translations.en}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Installed font' }))

    await waitFor(() => expect(listSystemFontFamilies).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('option', { name: /Aptos/ })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: /Aptos/ }))

    expect(onUpdate).toHaveBeenCalledWith({
      fontFamily: 'custom',
      customFontFamily: 'Aptos',
    })
  })

  it('adds the file association from the settings dialog', async () => {
    const user = userEvent.setup()
    const onToggleFileAssociation = vi.fn()
    renderDialog({ fileAssociationRegistered: false, onToggleFileAssociation })

    expect(screen.getByRole('heading', { name: 'File association' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add to the "Open with" list' }))

    expect(onToggleFileAssociation).toHaveBeenCalledTimes(1)
  })

  it('offers to remove the file association once it is registered', () => {
    renderDialog({
      fileAssociationRegistered: true,
      fileAssociationBusy: true,
      onToggleFileAssociation: vi.fn(),
    })

    const action = screen.getByRole('button', { name: 'Remove from the "Open with" list' })
    expect(action).toBeInTheDocument()
    expect(action).toBeDisabled()
  })

  it('hides the file association section without a platform handler', () => {
    renderDialog()

    expect(screen.queryByRole('heading', { name: 'File association' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /"Open with" list/ })).not.toBeInTheDocument()
  })
})

function renderDialog(props: {
  fileAssociationBusy?: boolean
  fileAssociationRegistered?: boolean
  onToggleFileAssociation?: () => void
} = {}) {
  return render(
    <ReadingSettingsDialog
      open
      preferences={DEFAULT_READING_PREFERENCES}
      onClose={vi.fn()}
      onReset={vi.fn()}
      onUpdate={vi.fn()}
      t={translations.en}
      {...props}
    />,
  )
}
