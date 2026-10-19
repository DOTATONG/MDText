import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FileAssociationClient, FileAssociationStatus } from '../platform/fileAssociation'
import { useFileAssociation } from './useFileAssociation'

const registered: FileAssociationStatus = {
  supported: true,
  registered: true,
  executablePath: 'C:\\Tools\\MDText.exe',
}

const unregistered: FileAssociationStatus = {
  supported: true,
  registered: false,
  executablePath: 'C:\\Tools\\MDText.exe',
}

describe('useFileAssociation', () => {
  it('reads the association status on mount', async () => {
    const { client, ...harness } = setup(registered)

    await waitFor(() => expect(harness.result.current.status).toEqual(registered))
    expect(client.getStatus).toHaveBeenCalledTimes(1)
  })

  it('registers the association and reports the new state', async () => {
    const { client, ...harness } = setup(unregistered)
    await waitFor(() => expect(harness.result.current.status).toEqual(unregistered))

    await act(async () => {
      await harness.result.current.toggle()
    })

    expect(client.setRegistered).toHaveBeenCalledWith(true)
    expect(harness.result.current.status).toEqual(registered)
    expect(harness.onNotify).toHaveBeenCalledWith('added')
  })

  it('removes the association again', async () => {
    const { client, ...harness } = setup(registered)
    await waitFor(() => expect(harness.result.current.status).toEqual(registered))

    await act(async () => {
      await harness.result.current.toggle()
    })

    expect(client.setRegistered).toHaveBeenCalledWith(false)
    expect(harness.result.current.status).toEqual(unregistered)
    expect(harness.onNotify).toHaveBeenCalledWith('removed')
  })

  it('reports a failed change without claiming a new state', async () => {
    const failure = new Error('Failed to write the registry value')
    const { ...harness } = setup(unregistered, { setRegisteredFailure: failure })
    await waitFor(() => expect(harness.result.current.status).toEqual(unregistered))

    await act(async () => {
      await harness.result.current.toggle()
    })

    expect(harness.onNotifyError).toHaveBeenCalledWith(failure)
    expect(harness.onNotify).not.toHaveBeenCalled()
    expect(harness.result.current.status).toEqual(unregistered)
  })

  it('reports a status that could not be read', async () => {
    const failure = new Error('Registry unavailable')
    const { ...harness } = setup(unregistered, { getStatusFailure: failure })

    await waitFor(() => expect(harness.onNotifyError).toHaveBeenCalledWith(failure))
    expect(harness.result.current.status).toBeNull()
  })
})

type SetupOptions = {
  getStatusFailure?: Error
  setRegisteredFailure?: Error
}

function setup(initialStatus: FileAssociationStatus, options: SetupOptions = {}) {
  const client: FileAssociationClient = {
    getStatus: vi.fn(async () => {
      if (options.getStatusFailure) {
        throw options.getStatusFailure
      }
      return initialStatus
    }),
    setRegistered: vi.fn(async (isRegistered: boolean) => {
      if (options.setRegisteredFailure) {
        throw options.setRegisteredFailure
      }
      return isRegistered ? registered : unregistered
    }),
  }
  const onNotify = vi.fn()
  const onNotifyError = vi.fn()
  const result = renderHook(() =>
    useFileAssociation({
      client,
      messages: { added: 'added', removed: 'removed' },
      onNotify,
      onNotifyError,
    }),
  )

  return { ...result, client, onNotify, onNotifyError }
}
