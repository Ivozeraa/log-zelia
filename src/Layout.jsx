import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { TeacherSchedule } from './components/dashboard/TeacherSchedule'

function AppPageFallback() {
  return (
    <div className="min-h-[50vh] w-full animate-pulse" aria-label="Carregando página">
      <div className="mb-5 h-8 w-48 rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
      <div className="h-4 w-72 max-w-full rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-32 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-32 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
      </div>
      <div className="mt-5 h-64 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50" />
    </div>
  )
}

function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/app' || location.pathname === '/app/'

  return (
    <div className="min-h-screen overflow-x-hidden font-inter bg-neutral-100 dark:bg-gray-950">
      <Header />

      <div className="pt-16 flex min-h-screen">
        <aside className="hidden md:block fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] z-40">
          <Sidebar />
        </aside>

        <main className="w-full min-w-0 md:ml-64 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 z-10 relative">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">
            {isHome && <TeacherSchedule />}
            <Suspense fallback={<AppPageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
