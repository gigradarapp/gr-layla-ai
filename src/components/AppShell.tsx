import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { BarChart3, CalendarDays, Compass, MessageCircle, Plane, Sparkles } from 'lucide-react'

const nav = [
  { to: '/', label: 'Plan', icon: Sparkles },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/trips', label: 'Trips', icon: CalendarDays },
  { to: '/book', label: 'Book', icon: Plane },
  { to: '/dashboard', label: 'Ops', icon: BarChart3 },
]

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const useFocusedLaylaShell = pathname === '/' || pathname === '/chat' || /^\/trips\/[^/]+/.test(pathname)

  return (
    <div className="app-shell">
      {useFocusedLaylaShell ? null : (
        <header className="topbar">
          <Link to="/" className="brand" aria-label="Trip Genius home">
            <span className="brand-mark">TG</span>
            <span>
              <strong>Trip Genius</strong>
              <small>AI travel planner</small>
            </span>
          </Link>
          <nav className="nav-links" aria-label="Primary navigation">
            {nav.map((item) => {
              const Icon = item.icon
              const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
              return (
                <Link key={item.to} to={item.to} className={active ? 'nav-link active' : 'nav-link'}>
                  <Icon size={16} aria-hidden="true" />
                  <span className="nav-label">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </header>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  )
}
