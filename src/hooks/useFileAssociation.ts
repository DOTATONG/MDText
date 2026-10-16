import { useCallback, useEffect, useState } from 'react'
import {
  tauriFileAssociation,
  type FileAssociationClient,
  type FileAssociationStatus,
} from '../platform/fileAssociation'

type UseFileAssociationOptions = {
  client?: FileAssociationClient
  /** Called after a successful change, with the message describing the new state. */
  onNotify: (message: string) => void
  onNotifyError: (error: unknown) => void
  messages: {
    added: string
    removed: string
  }
}

/**
 * Reads and toggles the Windows `.md` association for the current user.
 *
 * `status` stays `null` until the first read completes, and its `supported` flag is what decides
 * whether the action is offered at all.
 */
export function useFileAssociation({
  client = tauriFileAssociation,
  onNotify,
  onNotifyError,
  messages,
}: UseFileAssociationOptions) {
  const [status, setStatus] = useState<FileAssociationStatus | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    let disposed = false

    void client
      .getStatus()
      .then((next) => {
        if (!disposed) {
          setStatus(next)
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          onNotifyError(error)
        }
      })

    return () => {
      disposed = true
    }
  }, [client, onNotifyError])

  const toggle = useCallback(async () => {
    setIsUpdating(true)

    try {
      const next = await client.setRegistered(!status?.registered)
      setStatus(next)
      onNotify(next.registered ? messages.added : messages.removed)
    } catch (error) {
      onNotifyError(error)
    } finally {
      setIsUpdating(false)
    }
  }, [client, messages, onNotify, onNotifyError, status])

  return { isUpdating, status, toggle }
}
