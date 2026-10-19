// The frame around every screen: bottom menu on phones, side menu on a computer,
// and the round + button.

import { NavLink, Outlet } from 'react-router'
import { Icon } from '../ui/Icons.jsx'
import { useKeyboardClass } from '../ui/keyboard.js'

const NAV = [
  { to: '/', icon: 'today', label: 'Today', end: true },
  { to: '/week', icon: 'week', label: 'Week' },
  { to: '/stars', icon: 'star', label: 'Stars' },
  { to: '/stats', icon: 'stats', label: 'Stats' },
  { to: '/more', icon: 'more', label: 'More' },
]

export function Layout() {
  useKeyboardClass()
  return (
    <div className="min-h-dvh md:flex">
      <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line p-5 md:flex">
        <div className="mb-5 flex items-center gap-2 px-3 text-lg font-extrabold">
          <img src="/icons/icon.svg" alt="" className="size-8" />
          Organizer
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex h-12 items-center gap-3 rounded-[14px] px-3 text-base no-underline ${
                isActive ? 'bg-accent-soft font-bold text-accent' : 'font-semibold text-muted hover:bg-surface-2'
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main
        className="mx-auto w-full max-w-2xl px-5 pb-[calc(112px+env(safe-area-inset-bottom))] md:px-8 md:pb-16"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}
      >
        <Outlet />
      </main>

      <nav aria-label="Main" className="hide-on-keyboard pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden">
        <div className="grid h-[68px] grid-cols-5 px-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-xs no-underline ${isActive ? 'font-extrabold text-accent' : 'font-semibold text-muted'}`
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export function Fab({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="hide-on-keyboard fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-5 z-30 grid size-[60px] place-items-center rounded-full bg-accent text-on-accent shadow-lg transition active:scale-90 md:bottom-8 md:right-8"
    >
      <Icon name="plus" size={26} strokeWidth={2.4} />
    </button>
  )
}
