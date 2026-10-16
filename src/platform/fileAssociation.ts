import { invoke } from '@tauri-apps/api/core'

export type FileAssociationStatus = {
  /** Whether this platform can register associations at all. */
  supported: boolean
  /** Whether this executable is already registered for the current user. */
  registered: boolean
  /** The executable an association would launch. */
  executablePath: string
}

export type FileAssociationClient = {
  getStatus: () => Promise<FileAssociationStatus>
  setRegistered: (registered: boolean) => Promise<FileAssociationStatus>
}

const unsupportedStatus: FileAssociationStatus = {
  supported: false,
  registered: false,
  executablePath: '',
}

const unsupportedMessage = 'File associations are only available in the Windows desktop app.'

/**
 * Per-user registration of `.md` and `.markdown` under `HKCU`.
 *
 * The MSI installer writes machine-wide associations; this covers portable and development builds,
 * which have no installer, and gives installed users a way to re-add the association afterwards.
 * It only joins the "Open with" list and never takes over as the default handler.
 */
export const tauriFileAssociation: FileAssociationClient = {
  async getStatus() {
    if (!isTauriRuntime()) {
      return unsupportedStatus
    }

    return invoke<FileAssociationStatus>('get_markdown_file_association_status')
  },

  async setRegistered(registered) {
    if (!isTauriRuntime()) {
      throw new Error(unsupportedMessage)
    }

    return invoke<FileAssociationStatus>(
      registered ? 'register_markdown_file_association' : 'unregister_markdown_file_association',
    )
  },
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
