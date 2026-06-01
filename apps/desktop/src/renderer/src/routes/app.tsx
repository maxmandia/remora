import { Button } from '@remora/ui/button'
import { useEffect, useState } from 'react'

import { authBridge, type AuthErrorContext, type AuthUser } from '../lib/auth-bridge.ts'

type AuthStatus = 'loading' | 'signed-in' | 'signed-out'

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [isAuthOpening, setIsAuthOpening] = useState(false)

  useEffect(() => {
    let isMounted = true

    void authBridge
      .getUser()
      .then((nextUser) => {
        if (!isMounted) {
          return
        }

        setUser(nextUser)
        setStatus(nextUser ? 'signed-in' : 'signed-out')
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setStatus('signed-out')
        setError('Unable to read the current session.')
      })

    const unsubscribeAuthenticated = authBridge.onAuthenticated((nextUser) => {
      setUser(nextUser)
      setStatus('signed-in')
      setError(null)
      setIsAuthOpening(false)
    })
    const unsubscribeUserUpdated = authBridge.onUserUpdated((nextUser) => {
      setUser(nextUser)
      setStatus(nextUser ? 'signed-in' : 'signed-out')
    })
    const unsubscribeAuthError = authBridge.onAuthError((context) => {
      setError(formatAuthError(context))
      setIsAuthOpening(false)
    })

    return () => {
      isMounted = false
      unsubscribeAuthenticated()
      unsubscribeUserUpdated()
      unsubscribeAuthError()
    }
  }, [])

  async function handleRequestAuth() {
    setError(null)
    setIsAuthOpening(true)

    try {
      await authBridge.requestAuth()
    } catch {
      setError('Unable to open the sign-in flow.')
      setIsAuthOpening(false)
    }
  }

  async function handleSignOut() {
    setError(null)

    try {
      await authBridge.signOut()
      setUser(null)
      setStatus('signed-out')
    } catch {
      setError('Unable to sign out.')
    }
  }

  return (
    <main
      className="bg-[#14120b] p-6 text-[#edecec]"
      data-auth-status={status}
      data-user-id={user?.id}
    >
      <div className="flex flex-col gap-4">
        <Button disabled={isAuthOpening} onClick={handleRequestAuth}>
          Sign in
        </Button>
        <Button variant="secondary" onClick={handleSignOut}>
          Sign up
        </Button>
        {error ? (
          <p className="text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  )
}

function formatAuthError(context: AuthErrorContext) {
  return context.message ?? context.statusText ?? 'Authentication failed.'
}
