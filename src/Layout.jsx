import { Suspense, useEffect, useState } from 'react'
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
  const [cameraMode, setCameraMode] = useState(false)

  useEffect(() => {
    const handleCameraMode = (event) => setCameraMode(Boolean(event.detail?.active))
    window.addEventListener('logzelia:frequencia-camera', handleCameraMode)
    return () => window.removeEventListener('logzelia:frequencia-camera', handleCameraMode)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [location.pathname])

  return (
    <div className={`min-h-screen overflow-x-hidden font-inter ${cameraMode ? 'bg-[#101419]' : 'bg-neutral-100 dark:bg-gray-950'}`}>
      {!cameraMode && <Header />}

      <div className={`${cameraMode ? 'min-h-screen' : 'pt-16 flex min-h-screen'}`}>
        {!cameraMode && (
          <aside className="hidden md:block fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] z-40">
            <Sidebar />
          </aside>
        )}

        <main className={`w-full min-w-0 z-10 relative ${cameraMode ? 'min-h-screen' : 'md:ml-64 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6'}`}>
          <div className={`w-full min-w-0 ${cameraMode ? 'min-h-screen' : 'mx-auto max-w-[1600px]'}`}>
            {isHome && !cameraMode && <TeacherSchedule />}
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
