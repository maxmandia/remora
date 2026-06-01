import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { App } from './routes/app.tsx'

const rootRoute = createRootRoute({
  component: Root,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
})

function Root() {
  return (
    <div className="remora-desktop-shell">
      <div aria-hidden="true" className="remora-desktop-titlebar" />
      <div className="remora-desktop-content">
        <Outlet />
      </div>
    </div>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
