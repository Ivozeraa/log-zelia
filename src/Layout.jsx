import { Outlet } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'

function Layout() {
  return (
    <div className="font-inter">

      <Header />

      <div className="pt-16 flex">

        <aside className="hidden md:block fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] z-40">
          <Sidebar />
        </aside>

        <main className="w-full md:ml-64 p-4 sm:p-6 z-10 relative">
          <Outlet />
        </main>

      </div>
    </div>
  )
}

export default Layout