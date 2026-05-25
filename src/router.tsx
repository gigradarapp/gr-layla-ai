import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { AppShell } from './components/AppShell'
import { BookingPage } from './routes/BookingPage'
import { ChatPage } from './routes/ChatPage'
import { DashboardPage } from './routes/DashboardPage'
import { DiscoverPage } from './routes/DiscoverPage'
import { HomePage } from './routes/HomePage'
import { TripDetailPage } from './routes/TripDetailPage'
import { TripsPage } from './routes/TripsPage'

const rootRoute = createRootRoute({
  component: AppShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatPage,
})

const discoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/discover',
  component: DiscoverPage,
})

const tripsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trips',
  component: TripsPage,
})

const tripDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trips/$tripId',
  component: TripDetailPage,
})

const bookingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/book',
  validateSearch: (search: Record<string, unknown>) => ({
    tripId: typeof search.tripId === 'string' ? search.tripId : undefined,
  }),
  component: BookingPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  chatRoute,
  discoverRoute,
  tripsRoute,
  tripDetailRoute,
  bookingRoute,
  dashboardRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
