/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BootstrapGate } from './bootstrap-gate.tsx'

const mocks = vi.hoisted(() => {
  const queryFn = vi.fn()

  return {
    authState: {
      current: null as {
        user: { id: string } | null
        status: 'loading' | 'signed-in' | 'signed-out'
        error: string | null
        requestAuth: () => Promise<void>
        signOut: () => Promise<void>
      } | null,
    },
    queryFn,
    queryOptions: vi.fn((input: unknown, opts: Record<string, unknown>) => ({
      ...opts,
      queryKey: ['modelCatalog', 'listPublished', input],
      queryFn,
    })),
    queryFilter: vi.fn(() => ({
      queryKey: ['modelCatalog', 'listPublished'],
    })),
    signOut: vi.fn(),
  }
})

vi.mock('./auth-provider.tsx', () => ({
  useAuth: () => mocks.authState.current,
}))

vi.mock('../lib/trpc.ts', () => ({
  useTRPC: () => ({
    modelCatalog: {
      listPublished: {
        queryOptions: mocks.queryOptions,
        queryFilter: mocks.queryFilter,
      },
    },
  }),
}))

describe('BootstrapGate', () => {
  beforeEach(() => {
    mocks.queryFn.mockReset()
    mocks.queryOptions.mockClear()
    mocks.queryFilter.mockClear()
    mocks.signOut.mockReset()
    mocks.authState.current = createAuthState('loading')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders children immediately when signed out', () => {
    mocks.authState.current = createAuthState('signed-out')

    renderBootstrapGate()

    expect(screen.getByText('Ready route')).toBeTruthy()
    expect(mocks.queryFn).not.toHaveBeenCalled()
  })

  it('waits for the model catalog before rendering signed-in children', async () => {
    let resolveCatalog: () => void = () => undefined
    mocks.queryFn.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCatalog = resolve
      }),
    )
    mocks.authState.current = createAuthState('signed-in', {
      id: 'user_1',
    })

    const { container } = renderBootstrapGate()

    expect(container.querySelector('[data-auth-status="signed-in"]')).not.toBeNull()
    expect(screen.queryByText('Ready route')).toBeNull()

    resolveCatalog()

    await waitFor(() => {
      expect(screen.getByText('Ready route')).toBeTruthy()
    })
    expect(mocks.queryOptions).toHaveBeenCalledWith(undefined, {
      staleTime: 5 * 60 * 1000,
    })
  })

  it('shows retry and sign-out actions when bootstrap fails', async () => {
    mocks.queryFn.mockRejectedValue(new Error('catalog unavailable'))
    mocks.authState.current = createAuthState('signed-in', {
      id: 'user_1',
    })

    renderBootstrapGate()

    expect(await screen.findByText('Unable to prepare Remora.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })
})

function renderBootstrapGate() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BootstrapGate>
        <div>Ready route</div>
      </BootstrapGate>
    </QueryClientProvider>,
  )
}

function createAuthState(
  status: 'loading' | 'signed-in' | 'signed-out',
  user: { id: string } | null = null,
) {
  return {
    user,
    status,
    error: null,
    requestAuth: async () => undefined,
    signOut: mocks.signOut,
  }
}
