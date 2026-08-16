import { Outlet } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'

function Layout() {
  return (
    <div className="min-h-screen overflow-x-hidden font-inter bg-neutral-100 dark:bg-gray-950">
      <Header />

      <div className="pt-16 flex min-h-screen">
        <aside className="hidden md:block fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] z-40">
          <Sidebar />
        </aside>

        <main className="w-full min-w-0 md:ml-64 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 z-10 relative">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
